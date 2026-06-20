import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown, ChevronRight, Play, Check, Pause, Circle,
  ListPlus, GitBranchPlus, Maximize2, Users, X, MessageSquare, Trash2,
} from 'lucide-react'
import { cn } from '../../utils/cn'
import TaskMeta from '../tasks/TaskMeta'

// スキルツリー：ゴール/タスクのノードを接続線付きで再帰表示する。
// canEditGoals=false（メンバー）はゴールの追加・担当割当を出さない（タスクは全員可）。
export default function GoalTree({ tree, users, onToggleTask, onAddTask, onAddGoal, onAssignOwner, onOpenTask, onDeleteGoal, canEditGoals = true }) {
  return (
    <div>
      {tree.map((node) => (
        <Node
          key={node.id}
          node={node}
          users={users}
          depth={0}
          onToggleTask={onToggleTask}
          onAddTask={onAddTask}
          onAddGoal={onAddGoal}
          onAssignOwner={onAssignOwner}
          onOpenTask={onOpenTask}
          onDeleteGoal={onDeleteGoal}
          canEditGoals={canEditGoals}
        />
      ))}
    </div>
  )
}

function Node({ node, users, depth, onToggleTask, onAddTask, onAddGoal, onAssignOwner, onOpenTask, onDeleteGoal, canEditGoals }) {
  const navigate = useNavigate()
  const isGoal = node.kind === 'goal'
  const children = node.children ?? []
  const hasChildren = children.length > 0
  const [open, setOpen] = useState(depth < 2)
  const [addMode, setAddMode] = useState(null) // null | 'task' | 'goal'
  const [text, setText] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const owner = isGoal ? users[node.owner_id] : users[node.assignee_id]
  const taskCount = isGoal ? countOwnTasks(node) : null
  // ゴールの進捗％＝タスク完了から自動計算（タスクが無ければ手入力progress）
  const goalPct =
    taskCount && taskCount.total > 0
      ? Math.round((taskCount.done / taskCount.total) * 100)
      : node.progress ?? 0

  const startAdd = (mode) => {
    setAddMode(mode)
    setOpen(true)
  }

  const isSubtask = !isGoal && !!node.parent_task_id

  // 入力確定：ゴール→子ゴール/タスク、タスク→サブタスク（goal_idは親と同じ）
  const submitAdd = async () => {
    const t = text.trim()
    if (t) {
      if (addMode === 'goal') await onAddGoal(t, node.id)
      else if (isGoal) await onAddTask(node.id, t)
      else await onAddTask(node.goal_id, t, node.id)
    }
    setText('')
    setAddMode(null)
  }

  return (
    <div>
      <div className="group flex items-center gap-2 rounded-lg py-1.5 pr-2 hover:bg-zinc-50">
        {/* 展開トグル */}
        {hasChildren ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-5 w-5 items-center justify-center text-zinc-400 hover:text-zinc-700"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="h-5 w-5" />
        )}

        {/* ノード本体 */}
        {isGoal ? (
          <button
            onClick={() => navigate(`/goals/${node.id}`)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <ProgressBadge value={goalPct} />
            <span className="truncate text-sm font-semibold text-zinc-900">{node.title}</span>
            {owner && <Avatar user={owner} />}
          </button>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* 一番左＝担当者（主担当を大きく、残りはまとめて） */}
            <AssigneeStack ids={node.assigneeIds} users={users} />
            {/* 状態ラベル：タップで 未着手→進行中→完了 を巡回 */}
            <StatusPill
              status={node.status}
              onClick={() => onToggleTask(node)}
            />
            <button onClick={() => onOpenTask?.(node)} className="min-w-0 flex-1 text-left">
              <span
                className={cn(
                  'truncate text-sm',
                  node.status === 'done' ? 'text-zinc-400 line-through' : 'text-zinc-700',
                )}
              >
                {node.title}
              </span>
            </button>
          </div>
        )}

        {/* メタ：ゴールは完了数/全体（動的に集計＝完了で動く）＋コメント数、タスクは優先度等 */}
        {isGoal
          ? (taskCount.total > 0 || node.commentCount > 0) && (
              <span className="flex shrink-0 items-center gap-2 text-xs text-zinc-400">
                {taskCount.total > 0 && (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-500">
                    {taskCount.done}/{taskCount.total}
                  </span>
                )}
                {node.commentCount > 0 && (
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="h-3 w-3" />
                    {node.commentCount}
                  </span>
                )}
              </span>
            )
          : <TaskMeta task={node} commentCount={node.commentCount} />}

        {/* ホバーで出るクイック操作バー（本家のグレーのアイコン列に相当） */}
        {isGoal && (
          <div
            className={cn(
              'flex items-center gap-1 transition-opacity',
              pickerOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
          >
            <ToolButton title="タスクを追加" onClick={() => startAdd('task')}>
              <ListPlus className="h-4 w-4" />
            </ToolButton>
            {canEditGoals && (
              <ToolButton title="子ゴールを追加" onClick={() => startAdd('goal')}>
                <GitBranchPlus className="h-4 w-4" />
              </ToolButton>
            )}
            {canEditGoals && (
              <div className="relative">
                <ToolButton title="担当者を割り当て" onClick={() => setPickerOpen((v) => !v)}>
                  <Users className="h-4 w-4" />
                </ToolButton>
                {pickerOpen && (
                  <AssignPopover
                    members={Object.values(users)}
                    currentOwnerId={node.owner_id}
                    onPick={(uid) => {
                      onAssignOwner(node.id, uid)
                      setPickerOpen(false)
                    }}
                    onClose={() => setPickerOpen(false)}
                  />
                )}
              </div>
            )}
            <ToolButton title="詳細を開く" onClick={() => navigate(`/goals/${node.id}`)}>
              <Maximize2 className="h-4 w-4" />
            </ToolButton>
            {canEditGoals && onDeleteGoal && (
              <ToolButton
                title="ゴールを削除"
                onClick={() => {
                  if (confirm(`ゴール「${node.title}」を削除しますか？\n子ゴール・成果物・チャットも削除されます。元に戻せません。`))
                    onDeleteGoal(node.id)
                }}
              >
                <Trash2 className="h-4 w-4" />
              </ToolButton>
            )}
          </div>
        )}

        {/* タスク：サブタスク追加（上位タスクのみ）＋詳細（常時表示＝スマホのタップでも届く） */}
        {!isGoal && (
          <div className="flex items-center gap-1">
            {!isSubtask && (
              <ToolButton title="サブタスクを追加" onClick={() => startAdd('task')}>
                <ListPlus className="h-4 w-4" />
              </ToolButton>
            )}
            {onOpenTask && (
              <ToolButton title="詳細を開く" onClick={() => onOpenTask(node)}>
                <Maximize2 className="h-4 w-4" />
              </ToolButton>
            )}
          </div>
        )}
      </div>

      {/* 子（ツリーの枝分かれ線 ├─ └─ で親子を明示） */}
      {open && (hasChildren || addMode) && (
        <div className="ml-3">
          {children.map((child, i) => {
            const isLastRow = i === children.length - 1 && !addMode
            return (
              <div
                key={child.id}
                className={cn(
                  'relative pl-4',
                  "before:absolute before:left-0 before:top-0 before:w-px before:bg-zinc-300 before:content-['']",
                  isLastRow ? 'before:h-5' : 'before:h-full',
                  "after:absolute after:left-0 after:top-5 after:h-px after:w-4 after:bg-zinc-300 after:content-['']",
                )}
              >
                <Node
                  node={child}
                  users={users}
                  depth={depth + 1}
                  onToggleTask={onToggleTask}
                  onAddTask={onAddTask}
                  onAddGoal={onAddGoal}
                  onAssignOwner={onAssignOwner}
                  onOpenTask={onOpenTask}
                  onDeleteGoal={onDeleteGoal}
                  canEditGoals={canEditGoals}
                />
              </div>
            )
          })}
          {addMode && (
            <div className="relative flex items-center gap-3 py-1.5 pl-4 before:absolute before:left-0 before:top-0 before:h-5 before:w-px before:bg-zinc-300 before:content-[''] after:absolute after:left-0 after:top-5 after:h-px after:w-4 after:bg-zinc-300 after:content-['']">
              <span className="h-5 w-5" />
              {addMode === 'goal' ? (
                <span className="flex h-7 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-brand/40 px-1.5 text-[10px] font-bold text-brand">
                  0%
                </span>
              ) : (
                <span className="h-7 w-7 shrink-0 rounded-full border-2 border-dashed border-zinc-300" />
              )}
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
                onBlur={submitAdd}
                placeholder={addMode === 'goal' ? '子ゴールを入力して Enter' : 'タスクを入力して Enter'}
                className="flex-1 bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// 担当者ピッカー（メンバーから1人選んで owner に。未割当も可）
function AssignPopover({ members, currentOwnerId, onPick, onClose }) {
  return (
    <>
      {/* 外側クリックで閉じる透明な背面 */}
      <div className="fixed inset-0 z-10" onClick={onClose} />
      <div className="absolute right-0 top-7 z-20 w-44 overflow-hidden rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
        <div className="px-3 py-1 text-[11px] font-medium text-zinc-400">担当者</div>
        {members.map((m) => (
          <button
            key={m.id}
            onClick={() => onPick(m.id)}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50"
          >
            <Avatar user={m} />
            <span className="flex-1 truncate text-zinc-700">{m.name}</span>
            {m.id === currentOwnerId && <Check className="h-3.5 w-3.5 text-brand" />}
          </button>
        ))}
        <button
          onClick={() => onPick(null)}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-zinc-500 hover:bg-zinc-50"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-300">
            <X className="h-3 w-3" />
          </span>
          未割当にする
        </button>
      </div>
    </>
  )
}

// ホバー操作バーの小ボタン（薄いグレー → ホバーで濃く）
function ToolButton({ title, onClick, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
    >
      {children}
    </button>
  )
}

// タスクの状態ラベル（タップで巡回）。アイコン＋文字＋色で一目で分かるように。
// 進行中は青＝ゴール（紫）と色を分け、「作業中」がはっきり区別できる。
const STATUS_VISUAL = {
  todo: { label: '未着手', cls: 'border border-zinc-300 bg-white text-zinc-500', icon: <Circle className="h-3 w-3" /> },
  doing: { label: '進行中', cls: 'bg-blue-100 text-blue-700', icon: <Play className="h-3 w-3 fill-blue-700" /> },
  done: { label: '完了', cls: 'bg-emerald-100 text-emerald-700', icon: <Check className="h-3 w-3" strokeWidth={3} /> },
  blocked: { label: '待ち', cls: 'bg-amber-100 text-amber-700', icon: <Pause className="h-3 w-3 fill-amber-700" /> },
}

function StatusPill({ status, onClick }) {
  const v = STATUS_VISUAL[status] ?? STATUS_VISUAL.todo
  return (
    <button
      onClick={onClick}
      title="タップで状態を切替（未着手→進行中→完了）"
      className={cn(
        'flex w-[68px] shrink-0 items-center justify-center gap-1 rounded-full py-1 text-[11px] font-medium transition-colors',
        v.cls,
      )}
    >
      {v.icon}
      <span>{v.label}</span>
    </button>
  )
}

// ゴール直下のタスク（サブタスク含む・サブゴールは含めない）の done/total を集計
function countOwnTasks(node) {
  let done = 0
  let total = 0
  for (const c of node.children ?? []) {
    if (c.kind === 'task') {
      total++
      if (c.status === 'done') done++
      const sub = countOwnTasks(c)
      done += sub.done
      total += sub.total
    }
  }
  return { done, total }
}

// ゴールの目印＝四角バッジ（％）。タスクの丸（StatusCircle）と形で区別する。
function ProgressBadge({ value }) {
  return (
    <span className="flex h-7 shrink-0 items-center justify-center rounded-md bg-brand px-1.5 text-[10px] font-bold text-white">
      {value}%
    </span>
  )
}

function Avatar({ user, size = 'md', className = '' }) {
  const s = { sm: 'h-4 w-4 text-[9px]', md: 'h-5 w-5 text-[10px]', lg: 'h-7 w-7 text-[12px]' }[size]
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full font-bold text-white', s, className)}
      style={{ backgroundColor: user.avatar_color || '#6d5dfc' }}
      title={user.name}
    >
      {(user.name || '?').charAt(0).toUpperCase()}
    </span>
  )
}

// タスク左端の担当者表示：主担当を大きく、残りは小さく重ねてまとめる（多いと +N）。
function AssigneeStack({ ids, users }) {
  const list = (ids ?? []).map((id) => users[id]).filter(Boolean)
  if (list.length === 0) {
    return <span className="h-7 w-7 shrink-0 rounded-full border-2 border-dashed border-zinc-200" title="未割当" />
  }
  const [primary, ...rest] = list
  const shown = rest.slice(0, 2)
  const more = rest.length - shown.length
  return (
    <div className="flex shrink-0 items-center" title={list.map((u) => u.name).join('、')}>
      <Avatar user={primary} size="lg" />
      {shown.map((u) => (
        <Avatar key={u.id} user={u} size="sm" className="-ml-1.5 ring-2 ring-white" />
      ))}
      {more > 0 && (
        <span className="-ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-400 text-[9px] font-bold text-white ring-2 ring-white">
          +{more}
        </span>
      )}
    </div>
  )
}
