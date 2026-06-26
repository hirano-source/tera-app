import { useEffect, useMemo, useState } from 'react'
import { X, Compass, Play, Circle, CornerDownRight } from 'lucide-react'
import { supabase } from '../../utils/supabaseClient'
import { useWorkspace } from '../../hooks/useWorkspace'

// 「移動先ピッカー」：ゴール／タスクを別の親へ付け替える。
// item = { kind:'goal'|'task', id, title, parent_id?, goal_id?, parent_task_id? }
// ・ゴール移動 → 別の大目標／ゴールの下（または最上位）へ parent_id を付け替え。
// ・タスク移動 → 別のゴールの直下、または別のタスクの下（サブタスク）へ。
// 自分自身とその子孫は循環になるので選べない（グレーアウト）。
export default function MovePickerModal({ open, onClose, item, onMoved }) {
  const { currentId, current } = useWorkspace()
  const isTask = item?.kind === 'task'
  const [goals, setGoals] = useState([])
  const [tasks, setTasks] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !currentId) return
    let active = true
    ;(async () => {
      const [g, t] = await Promise.all([
        supabase.from('goals').select('id,title,parent_id,is_vision').eq('workspace_id', currentId).order('created_at'),
        isTask
          ? supabase.from('tasks').select('id,title,goal_id,parent_task_id').eq('workspace_id', currentId).order('created_at')
          : Promise.resolve({ data: [] }),
      ])
      if (!active) return
      setGoals(g.data ?? [])
      setTasks(t.data ?? [])
    })()
    return () => {
      active = false
    }
  }, [open, currentId, isTask])

  const isVision = (g) => g.is_vision || g.id === current?.visionGoalId

  const goalsByParent = useMemo(() => {
    const m = {}
    goals.forEach((g) => (m[g.parent_id] ??= []).push(g))
    return m
  }, [goals])

  const topTasksByGoal = useMemo(() => {
    const m = {}
    tasks.forEach((t) => {
      if (!t.parent_task_id && t.goal_id) (m[t.goal_id] ??= []).push(t)
    })
    return m
  }, [tasks])

  const subtasksByParent = useMemo(() => {
    const m = {}
    tasks.forEach((t) => {
      if (t.parent_task_id) (m[t.parent_task_id] ??= []).push(t)
    })
    return m
  }, [tasks])

  // 自分自身＋子孫（循環防止で選べない集合）
  const invalidIds = useMemo(() => {
    const set = new Set()
    if (!item) return set
    if (isTask) {
      const walk = (id) => {
        set.add(id)
        ;(subtasksByParent[id] ?? []).forEach((c) => walk(c.id))
      }
      walk(item.id)
    } else {
      const walk = (id) => {
        set.add(id)
        ;(goalsByParent[id] ?? []).forEach((c) => walk(c.id))
      }
      walk(item.id)
    }
    return set
  }, [item, isTask, goalsByParent, subtasksByParent])

  if (!open || !item) return null

  // 今いる場所か？（＝移動しても変わらない＝選んでも無意味なので無効化）
  const isCurrentGoalTarget = (goalId) =>
    isTask ? !item.parent_task_id && item.goal_id === goalId : item.parent_id === goalId
  const isCurrentTaskTarget = (taskId) => isTask && item.parent_task_id === taskId

  const doMove = async (patch) => {
    setBusy(true)
    try {
      const table = isTask ? 'tasks' : 'goals'
      const { error } = await supabase.from(table).update(patch).eq('id', item.id)
      if (error) throw error
      onMoved?.()
      onClose()
    } catch (e) {
      alert('移動に失敗しました: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const moveToGoal = (goalId) =>
    isTask ? doMove({ goal_id: goalId, parent_task_id: null }) : doMove({ parent_id: goalId })
  const moveUnderTask = (task) => doMove({ goal_id: task.goal_id, parent_task_id: task.id })
  const moveToTop = () => doMove({ parent_id: null })

  // 行を平坦化して描く（インデントで階層を示す）
  const rows = []
  const pushGoal = (g, depth) => {
    const isCur = isCurrentGoalTarget(g.id)
    const disabled = !isTask && (invalidIds.has(g.id) || isCur)
    rows.push(
      <Row
        key={'g' + g.id}
        depth={depth}
        icon={isVision(g) ? <Compass className="h-4 w-4 text-amber-500" /> : <Play className="h-3.5 w-3.5 fill-brand text-brand" />}
        label={g.title}
        sub={isVision(g) ? '大目標' : null}
        current={isCur}
        disabled={disabled || busy}
        onClick={() => moveToGoal(g.id)}
      />,
    )
    if (isTask) (topTasksByGoal[g.id] ?? []).forEach((tk) => pushTask(tk, depth + 1))
    ;(goalsByParent[g.id] ?? []).forEach((c) => pushGoal(c, depth + 1))
  }
  const pushTask = (tk, depth) => {
    const disabled = invalidIds.has(tk.id) || isCurrentTaskTarget(tk.id)
    rows.push(
      <Row
        key={'t' + tk.id}
        depth={depth}
        icon={<Circle className="h-3.5 w-3.5 text-zinc-400" />}
        label={tk.title}
        current={isCurrentTaskTarget(tk.id)}
        disabled={disabled || busy}
        onClick={() => moveUnderTask(tk)}
      />,
    )
    ;(subtasksByParent[tk.id] ?? []).forEach((st) => pushTask(st, depth + 1))
  }

  const visions = goals.filter(isVision).filter((g) => g.parent_id === null)
  const orphans = goals.filter((g) => !isVision(g) && g.parent_id === null)
  visions.forEach((v) => pushGoal(v, 0))
  orphans.forEach((o) => pushGoal(o, 0))

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4"
      onClick={(e) => {
        e.stopPropagation()
        onClose()
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0">
            <h3 className="font-bold">移動先を選ぶ</h3>
            <p className="truncate text-xs text-zinc-400">
              {isTask ? 'タスク' : 'ゴール'}「{item.title}」の移動先
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {/* ゴール移動だけ：最上位（どの大目標にも入れない）へ */}
          {!isTask && (
            <Row
              depth={0}
              icon={<CornerDownRight className="h-4 w-4 text-zinc-400" />}
              label="最上位（大目標に入れない）"
              current={item.parent_id === null}
              disabled={item.parent_id === null || busy}
              onClick={moveToTop}
            />
          )}
          {rows}
          {rows.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-400">移動先がありません。</p>
          )}
        </div>

        <div className="border-t border-zinc-200 px-5 py-3 text-center">
          <button onClick={onClose} className="text-sm text-zinc-500 hover:text-zinc-700">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ depth, icon, label, sub, current, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ paddingLeft: `${depth * 18 + 10}px` }}
      className={
        'flex w-full items-center gap-2 rounded-lg py-2 pr-3 text-left text-sm ' +
        (disabled ? 'cursor-not-allowed text-zinc-300' : 'text-zinc-700 hover:bg-zinc-50')
      }
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {sub && <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{sub}</span>}
      {current && <span className="shrink-0 text-[10px] text-zinc-400">現在地</span>}
    </button>
  )
}
