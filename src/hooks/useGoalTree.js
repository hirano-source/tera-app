import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'

const today = () => new Date().toISOString().slice(0, 10)

// 「今やるべきゴール」をスキルツリー（階層）で扱う。
// goals(parent_id) を入れ子にし、各ゴール配下に tasks(goal_id) を葉として付ける。
export function useGoalTree() {
  const { currentId, current, user } = useWorkspace()
  const [tree, setTree] = useState([])
  const [users, setUsers] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentId) return
    const [g, t, u, c, a] = await Promise.all([
      supabase.from('goals').select('*').eq('workspace_id', currentId).order('created_at'),
      supabase.from('tasks').select('*').eq('workspace_id', currentId).order('created_at'),
      supabase.from('users').select('id,name,avatar_color'),
      supabase.from('comments').select('target_type,target_id').eq('workspace_id', currentId),
      supabase.from('task_assignees').select('task_id,user_id').eq('workspace_id', currentId),
    ])
    const goals = g.data ?? []
    const tasks = t.data ?? []
    setUsers(Object.fromEntries((u.data ?? []).map((x) => [x.id, x])))

    // タスクごとの担当者一覧（複数担当）。主担当(assignee_id)を先頭に並べる。
    const assigneesByTask = {}
    ;(a.data ?? []).forEach((r) => {
      ;(assigneesByTask[r.task_id] ??= []).push(r.user_id)
    })
    const orderAssignees = (ta) => {
      const ids = assigneesByTask[ta.id] ?? []
      const rest = ids.filter((id) => id !== ta.assignee_id)
      return ta.assignee_id ? [ta.assignee_id, ...rest] : rest
    }

    // コメント数（ゴール/タスク別）
    const commentCount = {}
    ;(c.data ?? []).forEach((cm) => {
      const key = `${cm.target_type}:${cm.target_id}`
      commentCount[key] = (commentCount[key] ?? 0) + 1
    })

    const goalsByParent = {}
    goals.forEach((go) => {
      ;(goalsByParent[go.parent_id] ??= []).push(go)
    })
    // 直下タスク（親タスク無し）はゴールに、サブタスクは親タスクにぶら下げる
    const topTasksByGoal = {}
    const subtasksByParent = {}
    tasks.forEach((ta) => {
      if (ta.parent_task_id) (subtasksByParent[ta.parent_task_id] ??= []).push(ta)
      else if (ta.goal_id) (topTasksByGoal[ta.goal_id] ??= []).push(ta)
    })

    // タスクは粒度（大→中→小→サブ）に応じて何段でも入れ子にできる（段数制限なし）。
    const buildTask = (ta) => ({
      ...ta,
      kind: 'task',
      commentCount: commentCount[`task:${ta.id}`] ?? 0,
      assigneeIds: orderAssignees(ta),
      children: (subtasksByParent[ta.id] ?? []).map((st) => buildTask(st)),
    })

    const build = (parentId) =>
      (goalsByParent[parentId] ?? []).map((go) => ({
        ...go,
        kind: 'goal',
        commentCount: commentCount[`goal:${go.id}`] ?? 0,
        children: [
          ...build(go.id),
          ...(topTasksByGoal[go.id] ?? []).map((ta) => buildTask(ta)),
        ],
      }))

    setTree(build(null))
    setLoading(false)
  }, [currentId])

  useEffect(() => {
    load()
  }, [load])

  // ゴール作成（parentId 指定で配下に）。親未指定なら大目標(北極星)の下にぶら下げる＝頂点構造を維持（設計A）。
  const createGoal = async (title, parentId = null) => {
    const text = title.trim()
    if (!text || !currentId) return
    const parent = parentId ?? current?.visionGoalId ?? null
    await supabase.from('goals').insert({
      workspace_id: currentId,
      owner_id: user?.id ?? null,
      parent_id: parent,
      title: text,
      progress: 0,
    })
    await load()
  }

  // ゴールを削除（owner/adminのみRLSで許可）。子ゴール等はcascade、タスクは紐づけが外れる。
  const deleteGoal = async (goalId) => {
    if (!goalId) return
    await supabase.from('goals').delete().eq('id', goalId)
    await load()
  }

  // ゴール配下にタスクを追加（parentTaskId 指定で入れ子。goal_idは親と同じ）。
  // size=粒度（大/中/小/サブ）。入れ子で作るときは呼び出し側が「親より1段小さい」を渡す。
  const addTask = async (goalId, title, parentTaskId = null, size = null) => {
    const text = title.trim()
    if (!text || !currentId) return
    await supabase.from('tasks').insert({
      workspace_id: currentId,
      goal_id: goalId,
      parent_task_id: parentTaskId,
      assignee_id: user?.id ?? null,
      title: text,
      is_today: false,
      for_date: today(),
      source: 'goal',
      size,
    })
    await load()
  }

  // ゴールの担当者（owner）を割り当て / 解除（ownerId=null）
  const assignOwner = async (goalId, ownerId) => {
    if (!currentId) return
    setTree((prev) => setOwnerInTree(prev, goalId, ownerId))
    await supabase.from('goals').update({ owner_id: ownerId }).eq('id', goalId)
  }

  // タスクの状態をタップで巡回：未着手→進行中→完了→未着手（blockedは未着手へ）
  const CYCLE = { todo: 'doing', doing: 'done', done: 'todo', blocked: 'todo' }
  const toggleTask = async (task) => {
    const next = CYCLE[task.status] ?? 'doing'
    setTree((prev) => toggleInTree(prev, task.id, next))
    await supabase.from('tasks').update({ status: next }).eq('id', task.id)
  }

  return { tree, users, loading, reload: load, createGoal, addTask, toggleTask, assignOwner, deleteGoal }
}

// ツリー内の該当タスクの status を差し替える（楽観的更新）
function toggleInTree(nodes, taskId, status) {
  return nodes.map((n) => {
    if (n.kind === 'task' && n.id === taskId) return { ...n, status }
    if (n.children) return { ...n, children: toggleInTree(n.children, taskId, status) }
    return n
  })
}

// ツリー内の該当ゴールの owner_id を差し替える（楽観的更新）
function setOwnerInTree(nodes, goalId, ownerId) {
  return nodes.map((n) => {
    if (n.kind === 'goal' && n.id === goalId) return { ...n, owner_id: ownerId }
    if (n.children) return { ...n, children: setOwnerInTree(n.children, goalId, ownerId) }
    return n
  })
}
