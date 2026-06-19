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
      const [mem, users, goals, tasks, acts] = await withTimeout(
        Promise.all([
          supabase.from('memberships').select('role,user_id').eq('workspace_id', currentId),
          supabase.from('users').select('id,name,avatar_color'),
          supabase.from('goals').select('owner_id,progress').eq('workspace_id', currentId),
          supabase.from('tasks').select('assignee_id,status,title').eq('workspace_id', currentId),
          supabase
            .from('activities')
            .select('actor_id,summary,ts')
            .eq('workspace_id', currentId)
            .order('ts', { ascending: false }),
        ]),
        12000,
        'team fetch',
      )

      const userMap = new Map((users.data ?? []).map((u) => [u.id, u]))
      const goalRows = goals.data ?? []
      const taskRows = tasks.data ?? []
      const actRows = acts.data ?? []

      const list = (mem.data ?? []).map((m) => {
        const u = userMap.get(m.user_id) ?? { id: m.user_id, name: '（不明）' }
        const myGoals = goalRows.filter((g) => g.owner_id === u.id)
        const myTasks = taskRows.filter((t) => t.assignee_id === u.id)
        const progress = myGoals.length
          ? Math.round(myGoals.reduce((s, g) => s + (g.progress || 0), 0) / myGoals.length)
          : 0
        const doing = myTasks.find((t) => t.status === 'doing')
        const todo = myTasks.find((t) => t.status === 'todo')
        return {
          id: u.id,
          name: u.name,
          color: u.avatar_color || '#6d5dfc',
          role: m.role,
          progress,
          current: (doing || todo)?.title ?? null,
          blocked: myTasks.filter((t) => t.status === 'blocked').map((b) => b.title),
          done: myTasks.filter((t) => t.status === 'done').length,
          total: myTasks.length,
          lastActivity: actRows.find((a) => a.actor_id === u.id)?.summary ?? null,
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
    await supabase.from('activities').insert({
      workspace_id: currentId,
      actor_id: user?.id ?? null,
      type: 'task_assigned',
      summary: `タスクを割り当て: ${text}`,
    })
    await load()
  }

  return { members, loading, error, reload: load, assignTask }
}
