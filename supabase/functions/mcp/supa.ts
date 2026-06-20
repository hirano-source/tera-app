// MCPツールの Supabaseデータ層（ローカル版 mcp/supa.js のDeno移植）。
// 違いは「誰として動くか」だけ：ローカル版は1人の固定ログイン、ホスト版は
// リクエストのBearerトークンが指す “そのユーザー” として動く（RLSが効く＝各自の権限の範囲）。
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const today = () => new Date().toISOString().slice(0, 10)

// 1リクエスト分の「あなたとしての文脈」。Bearer解決時に作る。
export type Ctx = {
  db: SupabaseClient
  userId: string
  workspaceId: string | null
  workspaceName: string | null
}

// リフレッシュで得た生セッション（DBにキャッシュする素材）。
// access_token は Supabase が署名した本物のJWT（ES256・約1時間有効）。
export type Session = {
  accessToken: string
  refreshToken: string
  expiresAt: string // ISO。この時刻まではリフレッシュ不要で使い回せる。
  userId: string
}

// JWTのペイロードから sub(=userId) を取り出す（検証はPostgREST側に任せる）。
function subFromJwt(jwt: string): string {
  const part = jwt.split('.')[1] ?? ''
  const b64 = part.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(part.length / 4) * 4, '=')
  return JSON.parse(atob(b64)).sub
}

// リフレッシュトークンを1回だけ使い、生セッションを取り出す（=回転が起きる箇所）。
// 毎リクエストではなく「キャッシュ切れ時」と「接続時」だけ呼ぶ＝再利用検知の競合を避ける。
export async function refreshSession(refreshToken: string): Promise<Session> {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: sess, error } = await anon.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !sess.session) throw new Error(`セッション更新に失敗: ${error?.message ?? 'no session'}`)
  const expiresAtSec = sess.session.expires_at ?? Math.floor(Date.now() / 1000) + 3600
  return {
    accessToken: sess.session.access_token,
    refreshToken: sess.session.refresh_token,
    expiresAt: new Date(expiresAtSec * 1000).toISOString(),
    userId: sess.user!.id,
  }
}

// 有効な生アクセストークン(JWT)から「そのユーザーとしてのクライアント」を起こす。
// リフレッシュを伴わない＝回転しない。キャッシュが生きている間はこちらだけを通る。
export async function contextFromAccessToken(accessToken: string): Promise<Ctx> {
  const db = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
  const { data: mem } = await db
    .from('memberships').select('workspace_id, workspaces(name)').limit(1).maybeSingle()
  return {
    db,
    userId: subFromJwt(accessToken),
    workspaceId: mem?.workspace_id ?? null,
    workspaceName: (mem?.workspaces as { name?: string } | null)?.name ?? null,
  }
}

// ── 読み取り ────────────────────────────────────────────
export async function getContext(ctx: Ctx) {
  const { data: user } = await ctx.db
    .from('users').select('name,email').eq('id', ctx.userId).maybeSingle()
  return { workspace: ctx.workspaceName, user: user?.name, email: user?.email }
}

export async function listGoals(ctx: Ctx) {
  const { data } = await ctx.db
    .from('goals')
    .select('id,title,horizon,parent_id,progress,ideal_state,current,gap,criteria,due_date,owner_id')
    .eq('workspace_id', ctx.workspaceId)
    .order('created_at')
  return data ?? []
}

export async function listTasks(ctx: Ctx, { todayOnly = false, mine = false } = {}) {
  let q = ctx.db.from('tasks')
    .select('id,title,status,assignee_id,is_today,goal_id,priority,due_date,start_due_date,completion_criteria,approach,recurrence,blocker_type,blocker_owner,blocker_since,blocker_note')
    .eq('workspace_id', ctx.workspaceId)
  if (todayOnly) q = q.eq('is_today', true)
  if (mine) q = q.eq('assignee_id', ctx.userId)
  const { data } = await q.order('created_at')
  return data ?? []
}

export async function listMembers(ctx: Ctx) {
  const [{ data: mem }, { data: users }] = await Promise.all([
    ctx.db.from('memberships').select('role,user_id').eq('workspace_id', ctx.workspaceId),
    ctx.db.from('users').select('id,name'),
  ])
  const map = new Map((users ?? []).map((u) => [u.id, u.name]))
  return (mem ?? []).map((m) => ({ id: m.user_id, name: map.get(m.user_id), role: m.role }))
}

export async function getActivityLog(ctx: Ctx, { limit = 15 } = {}) {
  const { data } = await ctx.db
    .from('activities').select('ts,type,summary')
    .eq('workspace_id', ctx.workspaceId).order('ts', { ascending: false }).limit(limit)
  return data ?? []
}

// ── 書き込み ────────────────────────────────────────────
export async function createGoal(ctx: Ctx, { title, parentId = null }: { title: string; parentId?: string | null }) {
  const { data, error } = await ctx.db.from('goals')
    .insert({ workspace_id: ctx.workspaceId, owner_id: ctx.userId, parent_id: parentId, title, progress: 0 })
    .select().single()
  if (error) throw new Error(error.message)
  return data
}

// ゴールの中身を更新（理想/現状/差/完了基準/期日/担当/進捗/タイトル）。owner/adminのみRLSで許可。
export async function updateGoal(
  ctx: Ctx,
  a: {
    goalId: string
    title?: string
    idealState?: string
    current?: string
    gap?: string
    criteria?: string
    dueDate?: string | null
    ownerId?: string | null
    progress?: number
  },
) {
  const patch: Record<string, unknown> = {}
  if (a.title !== undefined) patch.title = a.title
  if (a.idealState !== undefined) patch.ideal_state = a.idealState
  if (a.current !== undefined) patch.current = a.current
  if (a.gap !== undefined) patch.gap = a.gap
  if (a.criteria !== undefined) patch.criteria = a.criteria
  if (a.dueDate !== undefined) patch.due_date = a.dueDate
  if (a.ownerId !== undefined) patch.owner_id = a.ownerId
  if (a.progress !== undefined) patch.progress = a.progress
  const { data, error } = await ctx.db.from('goals').update(patch).eq('id', a.goalId).select().maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

type TaskFields = {
  goalId?: string | null
  priority?: string
  dueDate?: string | null
  startDueDate?: string | null
  idealState?: string
  currentState?: string
  gap?: string
  approach?: string
  completionCriteria?: string
  recurrence?: string | null
}

// camelCase の追加項目を tasks の列(snake_case)に詰める共通処理。
function applyTaskFields(row: Record<string, unknown>, a: TaskFields) {
  if (a.goalId !== undefined) row.goal_id = a.goalId
  if (a.priority !== undefined) row.priority = a.priority
  if (a.dueDate !== undefined) row.due_date = a.dueDate
  if (a.startDueDate !== undefined) row.start_due_date = a.startDueDate
  if (a.idealState !== undefined) row.ideal_state = a.idealState
  if (a.currentState !== undefined) row.current_state = a.currentState
  if (a.gap !== undefined) row.gap = a.gap
  if (a.approach !== undefined) row.approach = a.approach
  if (a.completionCriteria !== undefined) row.completion_criteria = a.completionCriteria
  if (a.recurrence !== undefined) row.recurrence = a.recurrence
}

export async function createTask(
  ctx: Ctx,
  a: { title: string; assigneeId?: string | null; isToday?: boolean } & TaskFields,
) {
  const row: Record<string, unknown> = {
    workspace_id: ctx.workspaceId,
    assignee_id: a.assigneeId ?? ctx.userId,
    title: a.title,
    is_today: a.isToday ?? true,
    for_date: today(),
    source: a.goalId ? 'goal' : 'manual',
  }
  applyTaskFields(row, a)
  const { data, error } = await ctx.db.from('tasks').insert(row).select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTask(
  ctx: Ctx,
  a: { taskId: string; status?: string; title?: string } & TaskFields & {
    blockerType?: string; blockerOwner?: string; blockerNote?: string
  },
) {
  const patch: Record<string, unknown> = {}
  if (a.status !== undefined) patch.status = a.status
  if (a.title !== undefined) patch.title = a.title
  applyTaskFields(patch, a)
  if (a.blockerType !== undefined) patch.blocker_type = a.blockerType
  if (a.blockerOwner !== undefined) patch.blocker_owner = a.blockerOwner
  if (a.blockerNote !== undefined) patch.blocker_note = a.blockerNote
  // 「待ち」にしたら詰まり始め時刻を記録（3日で黄/7日で赤の判定に使う）
  if (a.status === 'blocked') patch.blocker_since = new Date().toISOString()
  const { data, error } = await ctx.db.from('tasks').update(patch).eq('id', a.taskId).select().maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function addComment(
  ctx: Ctx,
  { targetType, targetId, body }: { targetType: string; targetId: string; body: string },
) {
  const { data, error } = await ctx.db
    .from('comments')
    .insert({
      workspace_id: ctx.workspaceId,
      target_type: targetType,
      target_id: targetId,
      author_id: ctx.userId,
      body,
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function listComments(
  ctx: Ctx,
  { targetType, targetId }: { targetType: string; targetId: string },
) {
  const { data } = await ctx.db
    .from('comments')
    .select('id,body,author_id,resolved,created_at')
    .eq('workspace_id', ctx.workspaceId)
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at')
  return data ?? []
}

export async function deleteTask(ctx: Ctx, { taskId }: { taskId: string }) {
  // RLSで削除は owner/admin のみ許可。権限が無ければ0件削除＝実質no-op。
  const { error } = await ctx.db.from('tasks').delete().eq('id', taskId)
  if (error) throw new Error(error.message)
  return { deleted: taskId }
}

export async function logActivity(ctx: Ctx, { type, summary }: { type: string; summary: string }) {
  const { data, error } = await ctx.db.from('activities')
    .insert({ workspace_id: ctx.workspaceId, actor_id: ctx.userId, type, summary }).select().single()
  if (error) throw new Error(error.message)
  return data
}
