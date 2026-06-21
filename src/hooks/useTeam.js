import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'

const today = () => new Date().toISOString().slice(0, 10)

// 指定msで諦めるタイムアウト付きラッパ（ハングしても無限ローディングにしない）。
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms),
    ),
  ])

// チームの状況をメンバー別に集約＋メンバーへのタスク割当（RLSで自WSに限定）。
export function useTeam() {
  const { currentId, user } = useWorkspace()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!currentId) return
    setLoading(true)
    setError(null)
    try {
      const [mem, users, tasks] = await withTimeout(
        Promise.all([
          supabase.from('memberships').select('role,user_id').eq('workspace_id', currentId),
          supabase.from('users').select('id,name,avatar_color'),
          supabase
            .from('tasks')
            .select('assignee_id,status,title,created_at,updated_at')
            .eq('workspace_id', currentId)
            .order('updated_at', { ascending: false }),
        ]),
        12000,
        'team fetch',
      )

      // 進捗・直近の動きは「保存値や活動ログ」ではなく、生きてるタスクから都度導出する（陳腐化しない）。
      const userMap = new Map((users.data ?? []).map((u) => [u.id, u]))
      const taskRows = tasks.data ?? []
      const verb = (t) =>
        t.status === 'done' ? '完了' : t.status === 'blocked' ? '待ち' : new Date(t.updated_at) - new Date(t.created_at) < 1000 ? '追加' : '更新'

      const list = (mem.data ?? []).map((m) => {
        const u = userMap.get(m.user_id) ?? { id: m.user_id, name: '（不明）' }
        const myTasks = taskRows.filter((t) => t.assignee_id === u.id) // updated_at 降順
        const done = myTasks.filter((t) => t.status === 'done').length
        const total = myTasks.length
        const doing = myTasks.find((t) => t.status === 'doing')
        const todo = myTasks.find((t) => t.status === 'todo')
        const recent = myTasks[0]
        return {
          id: u.id,
          name: u.name,
          color: u.avatar_color || '#6d5dfc',
          role: m.role,
          progress: total ? Math.round((done / total) * 100) : 0,
          current: (doing || todo)?.title ?? null,
          blocked: myTasks.filter((t) => t.status === 'blocked').map((b) => b.title),
          done,
          total,
          lastActivity: recent ? `「${recent.title}」を${verb(recent)}` : null,
        }
      })
      setMembers(list)
      setLoading(false)
    } catch (e) {
      setError(e.message || '読み込みに失敗しました')
      setLoading(false)
    }
  }, [currentId])

  useEffect(() => {
    let active = true
    load().catch(() => {})
    return () => {
      active = false
    }
  }, [load])

  // メンバーにタスクを振る（今日のタスクとして割当）＋活動記録
  const assignTask = async (memberId, title) => {
    const text = title.trim()
    if (!text || !currentId) return
    await supabase.from('tasks').insert({
      workspace_id: currentId,
      assignee_id: memberId,
      title: text,
      is_today: true,
      for_date: today(),
      source: 'manual',
    })
    // 割り当てられた本人へ通知（自分自身への割当は通知しない）
    if (memberId !== user?.id) {
      await supabase.from('notifications').insert({
        workspace_id: currentId,
        user_id: memberId,
        type: 'task_assigned',
        payload: { title: text, by: user?.name ?? null },
      })
    }
    await load()
  }

  // 役職変更（owner/admin のみ。RPC側で権限チェック＋owner保護）
  const setRole = async (memberId, role) => {
    if (!currentId) return
    const { error } = await supabase.rpc('set_member_role', {
      p_workspace_id: currentId,
      p_user_id: memberId,
      p_role: role,
    })
    if (error) {
      alert('役職の変更に失敗しました: ' + error.message)
      return
    }
    await load()
  }

  return { members, loading, error, reload: load, assignTask, setRole }
}
