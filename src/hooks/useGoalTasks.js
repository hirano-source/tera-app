import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'

const today = () => new Date().toISOString().slice(0, 10)

// 1つのゴール配下のタスク（goal_id一致）を取得＋追加/完了切替。ゴール詳細のタスク欄用。
export function useGoalTasks(goalId) {
  const { currentId, user } = useWorkspace()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!goalId || !currentId) return
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: true })
    setTasks(data ?? [])
    setLoading(false)
  }, [goalId, currentId])

  useEffect(() => {
    load()
  }, [load])

  const addTask = async (title) => {
    const t = title.trim()
    if (!t || !goalId || !currentId) return
    const { data } = await supabase
      .from('tasks')
      .insert({
        workspace_id: currentId,
        goal_id: goalId,
        assignee_id: user?.id ?? null,
        title: t,
        source: 'goal',
        for_date: today(),
      })
      .select()
      .single()
    if (data) setTasks((ts) => [...ts, data])
  }

  const toggleTask = async (task) => {
    const next = task.status === 'done' ? 'todo' : 'done'
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    await supabase.from('tasks').update({ status: next }).eq('id', task.id)
  }

  return { tasks, loading, addTask, toggleTask, reload: load }
}
