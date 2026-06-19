import { Calendar, MessageSquare } from 'lucide-react'

// 優先度の色（P2=既定は目立たせない）
export const PRIORITY_META = {
  P0: { label: 'P0', cls: 'bg-red-100 text-red-700' },
  P1: { label: 'P1', cls: 'bg-orange-100 text-orange-700' },
  P2: { label: 'P2', cls: 'bg-blue-100 text-blue-700' },
  P3: { label: 'P3', cls: 'bg-zinc-100 text-zinc-600' },
  P4: { label: 'P4', cls: 'bg-zinc-100 text-zinc-500' },
}
export const STATUS_META = {
  todo: { label: '未着手', cls: 'text-zinc-400' },
  doing: { label: '着手', cls: 'text-sky-600' },
  blocked: { label: '待ち', cls: 'text-amber-600' },
  done: { label: '完了', cls: 'text-emerald-600' },
}

// タスク行に出す小さなメタ（優先度・期日・状態・コメント数）。ノイズを抑えるため
// P2(既定)・todo(既定)は出さない。
export default function TaskMeta({ task, commentCount = 0 }) {
  const p = PRIORITY_META[task.priority]
  const s = STATUS_META[task.status]
  const showP = p && task.priority && task.priority !== 'P2'
  const showS = s && task.status && task.status !== 'todo' && task.status !== 'done'
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs">
      {showP && <span className={`rounded px-1.5 py-0.5 font-bold ${p.cls}`}>{p.label}</span>}
      {task.due_date && (
        <span className="flex items-center gap-0.5 text-zinc-400">
          <Calendar className="h-3 w-3" />
          {fmtDate(task.due_date)}
        </span>
      )}
      {showS && <span className={s.cls}>{s.label}</span>}
      {commentCount > 0 && (
        <span className="flex items-center gap-0.5 text-zinc-400">
          <MessageSquare className="h-3 w-3" />
          {commentCount}
        </span>
      )}
    </span>
  )
}

function fmtDate(d) {
  const parts = String(d).split('-')
  if (parts.length < 3) return d
  return `${Number(parts[1])}/${Number(parts[2])}`
}
