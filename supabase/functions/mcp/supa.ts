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
