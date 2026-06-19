import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, Play, Check, Plus } from 'lucide-react'
import { cn } from '../../utils/cn'

// スキルツリー：ゴール/タスクのノードを接続線付きで再帰表示する。
export default function GoalTree({ tree, users, onToggleTask, onAddTask }) {
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
        />
      ))}
    </div>
  )
}

function Node({ node, users, depth, onToggleTask, onAddTask }) {
  const navigate = useNavigate()
  const isGoal = node.kind === 'goal'
  const children = node.children ?? []
  const hasChildren = children.length > 0
  const [open, setOpen] = useState(depth < 2)
  const [adding, setAdding] = useState(false)
  const [text, setText] = useState('')

  const owner = isGoal ? users[node.owner_id] : users[node.assignee_id]

  const submitTask = async () => {
    if (text.trim()) await onAddTask(node.id, text)
    setText('')
    setAdding(false)
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
            <ProgressBadge value={node.progress ?? 0} />
            <span className="truncate text-sm font-medium text-zinc-800">{node.title}</span>
            {owner && <Avatar user={owner} />}
          </button>
        ) : (
          <button
            onClick={() => onToggleTask(node)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                node.status === 'done' ? 'bg-emerald-500 text-white' : 'bg-brand text-white',
              )}
            >
              {node.status === 'done' ? (
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              ) : (
                <Play className="h-3 w-3 translate-x-0.5 fill-white" />
              )}
            </span>
            <span
              className={cn(
                'truncate text-sm',
                node.status === 'done' ? 'text-zinc-400 line-through' : 'text-zinc-700',
              )}
            >
              {node.title}
            </span>
            {owner && <Avatar user={owner} />}
          </button>
        )}

        {/* ゴールにタスク追加 */}
        {isGoal && (
          <button
            onClick={() => {
              setAdding(true)
              setOpen(true)
            }}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            title="タスクを追加"
          >
            <Plus className="h-4 w-4 text-zinc-400 hover:text-zinc-700" />
          </button>
        )}
      </div>

      {/* 子（接続線つき） */}
      {open && (hasChildren || adding) && (
        <div className="ml-[10px] border-l border-zinc-200 pl-3">
          {children.map((child) => (
            <Node
              key={child.id}
              node={child}
              users={users}
              depth={depth + 1}
              onToggleTask={onToggleTask}
              onAddTask={onAddTask}
            />
          ))}
          {adding && (
            <div className="flex items-center gap-3 py-1.5">
              <span className="h-5 w-5" />
              <span className="h-7 w-7 shrink-0 rounded-full border-2 border-dashed border-zinc-300" />
              <input
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitTask()}
                onBlur={submitTask}
                placeholder="タスクを入力して Enter"
                className="flex-1 bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ProgressBadge({ value }) {
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
      {value}
    </span>
  )
}

function Avatar({ user }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: user.avatar_color || '#6d5dfc' }}
      title={user.name}
    >
      {(user.name || '?').charAt(0).toUpperCase()}
    </span>
  )
}
