// MCPサーバー用 Supabaseデータ層。
// ローカルのMCPサーバーが、本物のSupabase（チーム共有データ）に
// 「あなた」としてサインインして読み書きする（RLSが効く＝あなたの権限の範囲）。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 環境変数 → なければ ../.env を素朴にパース（VITE_接頭辞も拾う）
function env(name, ...aliases) {
  for (const k of [name, ...aliases]) if (process.env[k]) return process.env[k]
  try {
    const raw = readFileSync(join(__dirname, '..', '.env'), 'utf-8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      for (const k of [name, ...aliases]) if (m[1] === k) return m[2].trim()
    }
  } catch {}
  return undefined
}

const URL = env('SUPABASE_URL', 'VITE_SUPABASE_URL')
const KEY = env('SUPABASE_KEY', 'VITE_SUPABASE_KEY')
const EMAIL = env('TERA_EMAIL')
const PASSWORD = env('TERA_PASSWORD')

const supabase = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

let ready = null // サインイン＋currentワークスペース解決を1度だけ
async function init() {
  if (ready) return ready
  ready = (async () => {
    if (!EMAIL || !PASSWORD) {
      throw new Error('TERA_EMAIL / TERA_PASSWORD が未設定です（.env に追加してください）')
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    })
    if (error) throw new Error(`サインイン失敗: ${error.message}`)
    const { data: me } = await supabase.auth.getUser()
    const { data: mem } = await supabase
      .from('memberships')
      .select('workspace_id, workspaces(name)')
      .limit(1)
      .maybeSingle()
    return {
      userId: me.user.id,
      workspaceId: mem?.workspace_id ?? null,
      workspaceName: mem?.workspaces?.name ?? null,
    }
  })()
  return ready
}

const today = () => new Date().toISOString().slice(0, 10)

// ── 読み取り ────────────────────────────────────────────
export async function getContext() {
  const ctx = await init()
  const { data: user } = await supabase
    .from('users').select('name,email').eq('id', ctx.userId).maybeSingle()
  return { workspace: ctx.workspaceName, user: user?.name, email: user?.email }
}

export async function listGoals() {
  const ctx = await init()
  const { data } = await supabase
    .from('goals').select('id,title,horizon,parent_id,progress,criteria')
    .eq('workspace_id', ctx.workspaceId).order('created_at')
  return data ?? []
}

export async function listTasks({ todayOnly = false, mine = false } = {}) {
  const ctx = await init()
  let q = supabase.from('tasks')
    .select('id,title,status,assignee_id,is_today').eq('workspace_id', ctx.workspaceId)
  if (todayOnly) q = q.eq('is_today', true)
  if (mine) q = q.eq('assignee_id', ctx.userId)
  const { data } = await q.order('created_at')
  return data ?? []
}

export async function listMembers() {
  const ctx = await init()
  const [{ data: mem }, { data: users }] = await Promise.all([
    supabase.from('memberships').select('role,user_id').eq('workspace_id', ctx.workspaceId),
    supabase.from('users').select('id,name'),
  ])
  const map = new Map((users ?? []).map((u) => [u.id, u.name]))
  return (mem ?? []).map((m) => ({ id: m.user_id, name: map.get(m.user_id), role: m.role }))
}

export async function getActivityLog({ limit = 15 } = {}) {
  const ctx = await init()
  const { data } = await supabase
    .from('activities').select('ts,type,summary')
    .eq('workspace_id', ctx.workspaceId).order('ts', { ascending: false }).limit(limit)
  return data ?? []
}

// ── 書き込み ────────────────────────────────────────────
export async function createGoal({ title, parentId = null }) {
  const ctx = await init()
  const { data, error } = await supabase.from('goals')
    .insert({ workspace_id: ctx.workspaceId, owner_id: ctx.userId, parent_id: parentId, title, progress: 0 })
    .select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function createTask({ title, assigneeId = null, isToday = false }) {
  const ctx = await init()
  const { data, error } = await supabase.from('tasks')
    .insert({ workspace_id: ctx.workspaceId, assignee_id: assigneeId ?? ctx.userId, title, is_today: isToday, for_date: today(), source: 'manual' })
    .select().single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateTask({ taskId, status, title }) {
  await init()
  const patch = {}
  if (status !== undefined) patch.status = status
  if (title !== undefined) patch.title = title
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', taskId).select().maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function logActivity({ type, summary }) {
  const ctx = await init()
  const { data, error } = await supabase.from('activities')
    .insert({ workspace_id: ctx.workspaceId, actor_id: ctx.userId, type, summary }).select().single()
  if (error) throw new Error(error.message)
  return data
}
