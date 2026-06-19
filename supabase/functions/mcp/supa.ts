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
  refreshToken: string   // 回転後の最新リフレッシュトークン（保存し直す用）
}

// 保存しておいたリフレッシュトークンから「そのユーザーとしてのクライアント」を起こす。
// 成功すると RLS が auth.uid()=このユーザー で効く。
export async function contextFromRefresh(refreshToken: string): Promise<Ctx> {
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: sess, error } = await anon.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !sess.session) throw new Error(`セッション更新に失敗: ${error?.message ?? 'no session'}`)

  // ユーザーのJWTを明示的に付けたクライアント＝以後の全クエリにRLSが効く
  const db = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${sess.session.access_token}` } },
  })
  const userId = sess.user!.id
  const { data: mem } = await db
    .from('memberships').select('workspace_id, workspaces(name)').limit(1).maybeSingle()
  return {
    db,
    userId,
    workspaceId: mem?.workspace_id ?? null,
    workspaceName: (mem?.workspaces as { name?: string } | null)?.name ?? null,
    refreshToken: sess.session.refresh_token,
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
    .from('goals').select('id,title,horizon,parent_id,progress,criteria')
    .eq('workspace_id', ctx.workspaceId).order('created_at')
  return data ?? []
}

export async function listTasks(ctx: Ctx, { todayOnly = false, mine = false } = {}) {
  let q = ctx.db.from('tasks')
    .select('id,title,status,assignee_id,is_today').eq('workspace_id', ctx.workspaceId)
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

export async function createTask(
  ctx: Ctx,
  { title, assigneeId = null, isToday = true }: { title: string; assigneeId?: string | null; isToday?: boolean },
) {
  const { data, error } = await ctx.db.from('tasks')
    .insert({ workspace_id: ctx.workspaceId, assignee_id: assigneeId ?? ctx.userId, title, is_today: isToday, for_date: today(), source: 'manual' })
    .select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTask(
  ctx: Ctx,
  { taskId, status, title }: { taskId: string; status?: string; title?: string },
) {
  const patch: Record<string, unknown> = {}
  if (status !== undefined) patch.status = status
  if (title !== undefined) patch.title = title
  const { data, error } = await ctx.db.from('tasks').update(patch).eq('id', taskId).select().maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function logActivity(ctx: Ctx, { type, summary }: { type: string; summary: string }) {
  const { data, error } = await ctx.db.from('activities')
    .insert({ workspace_id: ctx.workspaceId, actor_id: ctx.userId, type, summary }).select().single()
  if (error) throw new Error(error.message)
  return data
}
