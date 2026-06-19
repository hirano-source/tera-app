import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'

const today = () => new Date().toISOString().slice(0, 10)

// 今日のToDo（is_today=true のタスク）を現在のワークスペースで取得＋作成/完了切替。
export function useTodayTodo() {
  const { currentId, user } = useWorkspace()
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentId) return
    let active = true
    supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', currentId)
      .eq('is_today', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!active) return
        setTodos(data ?? [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [currentId])

  // 完了/未完了の切替（楽観的更新）
  const toggleTask = async (task) => {
    const next = task.status === 'done' ? 'todo' : 'done'
    setTodos((ts) => ts.map((t) => (t.id === task.id ? { ...t, status: next } : t)))
    await supabase.from('tasks').update({ status: next }).eq('id', task.id)
  }

  // 今日のタスクを追加（自分担当）
  const addTask = async (title) => {
    const text = title.trim()
    if (!text || !currentId) return
    const { data } = await supabase
      .from('tasks')
      .insert({
        workspace_id: currentId,
        assignee_id: user?.id ?? null,
        title: text,
        is_today: true,
        for_date: today(),
        source: 'manual',
      })
      .select()
      .single()
    if (data) setTodos((ts) => [...ts, data])
  }

  return {
    todos,
    loading,
    toggleTask,
    addTask,
    claudeMessage: 'Claudeが今日のゴールから問いを用意しました',
  }
}
