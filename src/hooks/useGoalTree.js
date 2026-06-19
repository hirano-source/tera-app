import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'

const today = () => new Date().toISOString().slice(0, 10)

// 「今やるべきゴール」をスキルツリー（階層）で扱う。
// goals(parent_id) を入れ子にし、各ゴール配下に tasks(goal_id) を葉として付ける。
export function useGoalTree() {
  const { currentId, user } = useWorkspace()
  const [tree, setTree] = useState([])
  const [users, setUsers] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentId) return
    const [g, t, u] = await Promise.all([
      supabase.from('goals').select('*').eq('workspace_id', currentId).order('created_at'),
      supabase.from('tasks').select('*').eq('workspace_id', currentId).order('created_at'),
      supabase.from('users').select('id,name,avatar_color'),
    ])
    const goals = g.data ?? []
    const tasks = t.data ?? []
    setUsers(Object.fromEntries((u.data ?? []).map((x) => [x.id, x])))

    const goalsByParent = {}
    goals.forEach((go) => {
      ;(goalsByParent[go.parent_id] ??= []).push(go)
    })
    const tasksByGoal = {}
    tasks.forEach((ta) => {
      if (ta.goal_id) (tasksByGoal[ta.goal_id] ??= []).push(ta)
    })

    const build = (parentId) =>
      (goalsByParent[parentId] ?? []).map((go) => ({
        ...go,
        kind: 'goal',
        children: [
          ...build(go.id),
          ...(tasksByGoal[go.id] ?? []).map((ta) => ({ ...ta, kind: 'task' })),
        ],
      }))

    setTree(build(null))
    setLoading(false)
  }, [currentId])

  useEffect(() => {
    load()
  }, [load])

  // ゴール作成（parentId 指定で配下に）
  const createGoal = async (title, parentId = null) => {
    const text = title.trim()
    if (!text || !currentId) return
    await supabase.from('goals').insert({
      workspace_id: currentId,
      owner_id: user?.id ?? null,
      parent_id: parentId,
      title: text,
      progress: 0,
    })
    await load()
  }

  // ゴール配下にタスクを追加
  const addTask = async (goalId, title) => {
    const text = title.trim()
    if (!text || !currentId) return
    await supabase.from('tasks').insert({
      workspace_id: currentId,
      goal_id: goalId,
      assignee_id: user?.id ?? null,
      title: text,
      is_today: false,
      for_date: today(),
      source: 'goal',
    })
    await load()
  }

  // タスク完了/未完了トグル
  const toggleTask = async (task) => {
    const next = task.status === 'done' ? 'todo' : 'done'
    setTree((prev) => toggleInTree(prev, task.id, next))
    await supabase.from('tasks').update({ status: next }).eq('id', task.id)
  }

  return { tree, users, loading, reload: load, createGoal, addTask, toggleTask }
}

// ツリー内の該当タスクの status を差し替える（楽観的更新）
function toggleInTree(nodes, taskId, status) {
  return nodes.map((n) => {
    if (n.kind === 'task' && n.id === taskId) return { ...n, status }
    if (n.children) return { ...n, children: toggleInTree(n.children, taskId, status) }
    return n
  })
}
