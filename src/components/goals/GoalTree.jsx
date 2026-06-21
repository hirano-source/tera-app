import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown, ChevronRight, Play, Check, Pause, Circle,
  ListPlus, GitBranchPlus, Maximize2, Users, X, Trash2,
} from 'lucide-react'
import { cn } from '../../utils/cn'

// スキルツリー：ゴール/タスクのノードを再帰表示する。
// 設計方針：タイトルを主役に、装飾は最小限。状態＝左の丸アイコン1つ、
// 優先度＝左の色帯（赤P0/橙P1）、担当＝小さめアイコン、日付＝小さく右。
// 操作アイコンはホバー時のみ（スマホは行タップで詳細を開く）。
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

  const owner = isGoal ? users[node.owner_id] : null
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

  // 入力確定：ゴール→子ゴール/タスク、タスク→入れ子タスク（goal_idは親と同じ）。
  // 入れ子で作るタスクは「親より1段小さい粒度」を既定にする（大→中→小→サブ）。
  const submitAdd = async () => {
    const t = text.trim()
    if (t) {
      if (addMode === 'goal') await onAddGoal(t, node.id)
      else if (isGoal) await onAddTask(node.id, t)
      else await onAddTask(node.goal_id, t, node.id, nextSize(node.size))
    }
    setText('')
    setAddMode(null)
  }

  return (
    <div>
      <div className="group flex items-center gap-2.5 rounded-lg py-2 pr-2 hover:bg-zinc-50">
        {/* 展開トグル */}
        {hasChildren ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-zinc-400 hover:text-zinc-700"
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="h-5 w-5 shrink-0" />
        )}

        {/* ノード本体 */}
        {isGoal ? (
          <>
            <button
              onClick={() => navigate(`/goals/${node.id}`)}
              className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            >
              <ProgressBadge value={goalPct} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-900">{node.title}</span>
            </button>
            {taskCount.total > 0 && (
              <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
                {taskCount.done}/{taskCount.total}
              </span>
            )}
            {owner && <Avatar user={owner} />}
          </>
        ) : (
          <>
            {/* 優先度＝左の色帯（赤P0/橙P1、それ以下は無印）。色だけで緊急度が分かる。 */}
            <span className={cn('h-6 w-1 shrink-0 rounded-full', PRIORITY_ACCENT[node.priority] ?? 'bg-transparent')} />
            {/* 状態＝丸アイコン1つ（タップで 未着手→進行中→完了 を巡回）*/}
            <StatusCircle status={node.status} onClick={() => onToggleTask(node)} />
            {/* 粒度＝大/中/小/サブ（設定済みのときだけ。無印は出さない） */}
            <SizeChip size={node.size} />
            {/* タイトル＝主役。タップで詳細を開く。 */}
            <button onClick={() => onOpenTask?.(node)} className="min-w-0 flex-1 text-left">
              <span
                className={cn(
                  'block truncate text-sm',
                  node.status === 'done' ? 'text-zinc-400 line-through' : 'text-zinc-700',
                )}
              >
                {node.title}
              </span>
            </button>
            <DueDate date={node.due_date} done={node.status === 'done'} />
            <AssigneeStack ids={node.assigneeIds} users={users} />
          </>
        )}

        {/* ゴールのホバー操作（追加・割当・詳細・削除）。スマホでは隠れる＝ふだんスッキリ。 */}
        {isGoal && (
          <div
            className={cn(
              'shrink-0 items-center gap-1',
              pickerOpen ? 'flex' : 'hidden group-hover:flex',
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

        {/* タスクのホバー操作（1段小さいタスクを追加＝ブレイクダウン）。ふだんは隠す。 */}
        {!isGoal && (
          <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
            <ToolButton title="1段小さいタスクを追加（ブレイクダウン）" onClick={() => startAdd('task')}>
              <ListPlus className="h-4 w-4" />
            </ToolButton>
          </div>
        )}
      </div>

      {/* 子（細い接続線でゆるく親子を示す） */}
      {open && (hasChildren || addMode) && (
        <div className="ml-3">
          {children.map((child, i) => {
            const isLastRow = i === children.length - 1 && !addMode
            return (
              <div
                key={child.id}
                className={cn(
                  'relative pl-4',
                  "before:absolute before:left-0 before:top-0 before:w-px before:bg-zinc-200 before:content-['']",
                  isLastRow ? 'before:h-6' : 'before:h-full',
                  "after:absolute after:left-0 after:top-6 after:h-px after:w-4 after:bg-zinc-200 after:content-['']",
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
            <div className="relative flex items-center gap-3 py-1.5 pl-4 before:absolute before:left-0 before:top-0 before:h-6 before:w-px before:bg-zinc-200 before:content-[''] after:absolute after:left-0 after:top-6 after:h-px after:w-4 after:bg-zinc-200 after:content-['']">
              <span className="h-5 w-5" />
              {addMode === 'goal' ? (
                <span className="flex h-7 shrink-0 items-center justify-center rounded-md border-2 border-dashed border-brand/40 px-1.5 text-[10px] font-bold text-brand">
                  0%
                </span>
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-zinc-300" />
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

// 優先度の左色帯（緊急度を色だけで伝える。P2以下は無印＝ノイズにしない）
export const PRIORITY_ACCENT = { P0: 'bg-red-500', P1: 'bg-amber-400' }

// 粒度（工数の大きさ）。緊急度(色)とは別軸なのでグレースケールで表す。
// 大＝濃い→サブ＝薄い枠線、で「大きさ」が一目で分かる。時間目安は title に出す。
const SIZE_META = {
  big: { label: '大', cls: 'bg-zinc-700 text-white' },
  mid: { label: '中', cls: 'bg-zinc-300 text-zinc-700' },
  small: { label: '小', cls: 'bg-zinc-100 text-zinc-500' },
  sub: { label: 'サブ', cls: 'border border-zinc-300 text-zinc-400' },
}
const SIZE_HINT = {
  big: '大タスク（〜3ヶ月）',
  mid: '中タスク（〜1週間）',
  small: '小タスク（〜3日）',
  sub: 'サブタスク（〜3時間）',
}
const SIZE_ORDER = ['big', 'mid', 'small', 'sub']
// 1段小さい粒度を返す（入れ子で子タスクを作るときの既定）。親が未設定なら子も未設定。
function nextSize(size) {
  const i = SIZE_ORDER.indexOf(size)
  if (i < 0) return null
  return SIZE_ORDER[Math.min(i + 1, SIZE_ORDER.length - 1)]
}

// 粒度バッジ（設定済みのときだけ表示）。
export function SizeChip({ size }) {
  const m = SIZE_META[size]
  if (!m) return null
  return (
    <span
      className={cn('flex h-5 shrink-0 items-center justify-center rounded px-1 text-[10px] font-bold leading-none', m.cls)}
      title={SIZE_HINT[size]}
    >
      {m.label}
    </span>
  )
}

// タスクの状態＝丸アイコン1つ。タップで 未着手→進行中→完了 を巡回。
// 未着手は中空の丸、進行中は青、完了は緑、待ちは琥珀。形は同じで色で状態を示す。
function StatusCircle({ status, onClick }) {
  const common = 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white'
  let inner
  if (status === 'doing') inner = <span className={cn(common, 'bg-blue-500')}><Play className="h-2.5 w-2.5 fill-white" /></span>
  else if (status === 'done') inner = <span className={cn(common, 'bg-emerald-500')}><Check className="h-3 w-3" strokeWidth={3} /></span>
  else if (status === 'blocked') inner = <span className={cn(common, 'bg-amber-500')}><Pause className="h-2.5 w-2.5 fill-white" /></span>
  else inner = <Circle className="h-5 w-5 shrink-0 text-zinc-300" />
  return (
    <button onClick={onClick} title="タップで状態を切替（未着手→進行中→完了）" className="shrink-0">
      {inner}
    </button>
  )
}

// 期日（小さく右に）。今日以前で未完了なら赤＝「急ぎ」が一目で分かる。
const TODAY = new Date().toISOString().slice(0, 10)
export function DueDate({ date, done }) {
  if (!date) return null
  const urgent = !done && String(date).slice(0, 10) <= TODAY
  return (
    <span className={cn('shrink-0 text-xs tabular-nums', urgent ? 'font-medium text-red-500' : 'text-zinc-400')}>
      {fmtMD(date)}
    </span>
  )
}
function fmtMD(d) {
  const p = String(d).split('-')
  return p.length < 3 ? d : `${Number(p[1])}/${Number(p[2])}`
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

// タスク右端の担当者表示：主担当＋残りを小さく重ねてまとめる（多いと +N）。
function AssigneeStack({ ids, users }) {
  const list = (ids ?? []).map((id) => users[id]).filter(Boolean)
  if (list.length === 0) {
    return <span className="h-5 w-5 shrink-0 rounded-full border border-dashed border-zinc-200" title="未割当" />
  }
  const [primary, ...rest] = list
  const shown = rest.slice(0, 2)
  const more = rest.length - shown.length
  return (
    <div className="flex shrink-0 items-center" title={list.map((u) => u.name).join('、')}>
      <Avatar user={primary} size="md" />
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
