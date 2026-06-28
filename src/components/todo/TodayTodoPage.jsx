import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Check, Trash2, Compass, ChevronDown, ChevronRight } from 'lucide-react'
import { useTodayTodo } from '../../hooks/useTodayTodo'
import { useGoalTree } from '../../hooks/useGoalTree'
import { useWorkspace } from '../../hooks/useWorkspace'
import GoalTree, { PRIORITY_ACCENT, DueDate } from '../goals/GoalTree'
import MicButton from '../common/MicButton'
import TaskDetailModal from '../tasks/TaskDetailModal'
import MovePickerModal from '../common/MovePickerModal'
import { GOAL_MAX } from '../../utils/limits'

// 今日のToDo 画面 (/todo)。
export default function TodayTodoPage() {
  const { current, user } = useWorkspace()
  const canEditGoals = ['owner', 'admin'].includes(current?.role)
  const { todos, toggleTask, addTask, deleteTask, reload: reloadTodos } = useTodayTodo()
  const {
    tree,
    users,
    createGoal,
    addTask: addGoalTask,
    toggleTask: toggleGoalTask,
    assignOwner,
    deleteGoal,
    reload: reloadTree,
  } = useGoalTree()
  const [addingTask, setAddingTask] = useState(false)
  const [taskText, setTaskText] = useState('')
  const [goalText, setGoalText] = useState('')
  const [addingGoalFor, setAddingGoalFor] = useState(null) // 入力中の大目標id
  const [openTaskId, setOpenTaskId] = useState(null)
  const [moveItem, setMoveItem] = useState(null) // 移動中のゴール/タスク
  // 完了レーンの開閉。既定は畳む。次回も維持するため localStorage に記憶。
  const [doneOpen, setDoneOpen] = useState(() => {
    try { return localStorage.getItem('savo:todoDoneOpen') === '1' } catch { return false }
  })
  const toggleDoneOpen = () =>
    setDoneOpen((v) => {
      const next = !v
      try { localStorage.setItem('savo:todoDoneOpen', next ? '1' : '0') } catch {}
      return next
    })
  const navigate = useNavigate()

  // 大目標（is_vision）は複数。絶対目標なのでツリーには入れず別格の見出しにし、
  // その配下（子ゴール／タスク）だけをツリーに渡す。大目標の追加/削除は事業設定だけ。
  const isVision = (n) => n.kind === 'goal' && (n.is_vision || n.id === current?.visionGoalId)
  const visionNodes = tree.filter(isVision)
  // どの大目標にも属さない最上位ノード（旧データの受け皿）
  const orphanNodes = tree.filter((n) => !isVision(n))

  // 上の「今日のToDo」と下のツリーは同じタスクを別フックで保持している。
  // 片方を操作したら、もう片方も再取得して整合を取る（完了切替・削除が両方に反映される）。
  const handleToggleTodo = async (todo) => {
    await toggleTask(todo)
    reloadTree()
  }
  const handleToggleTreeTask = async (node) => {
    await toggleGoalTask(node)
    reloadTodos()
  }
  const handleDeleteTodo = async (todo) => {
    await deleteTask(todo)
    reloadTree()
  }

  const submitTask = async () => {
    await addTask(taskText)
    setTaskText('')
    setAddingTask(false)
  }
  const submitGoal = async (visionId) => {
    await createGoal(goalText, visionId)
    setGoalText('')
    setAddingGoalFor(null)
  }

  // 完了は別グループへ。未完了（active）だけ常時表示し、完了は折りたたみに回す。
  const activeTodos = todos.filter((t) => t.status !== 'done')
  const doneTodos = todos.filter((t) => t.status === 'done')
  const renderTodoRow = (todo) => (
    <li
      key={todo.id}
      className="group flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-zinc-50"
    >
      {/* 優先度＝左の色帯（ツリーと統一） */}
      <span className={'h-6 w-1 shrink-0 rounded-full ' + (PRIORITY_ACCENT[todo.priority] ?? 'bg-transparent')} />
      <button
        onClick={() => handleToggleTodo(todo)}
        className={
          todo.status === 'done'
            ? 'flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500 text-white'
            : 'h-5 w-5 shrink-0 rounded-md border-2 border-zinc-300 hover:border-emerald-400'
        }
      >
        {todo.status === 'done' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
      <button
        onClick={() => setOpenTaskId(todo.id)}
        className={
          'min-w-0 flex-1 truncate text-left text-[15px] font-medium ' +
          (todo.status === 'done' ? 'text-zinc-400 line-through' : 'text-zinc-700')
        }
      >
        {todo.title}
      </button>
      <DueDate date={todo.due_date} done={todo.status === 'done'} />
      {(canEditGoals || todo.assignee_id === user?.id) && (
        <button
          onClick={() => {
            if (confirm(`タスク「${todo.title}」を削除しますか？`)) handleDeleteTodo(todo)
          }}
          title="削除"
          className="hidden shrink-0 rounded-md p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500 group-hover:block"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  )

  return (
    <div className="relative mx-auto max-w-[1280px] px-4 py-6 sm:px-10 sm:py-8">
      {/* === 今日のToDo === */}
      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">今日のToDo</h1>
            <button
              onClick={() => setAddingTask((v) => !v)}
              className="text-zinc-400 hover:text-zinc-600"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        </div>

        <hr className="my-4 border-zinc-200" />

        {/* 今日のToDo（Supabaseの実データ。クリックで完了切替）*/}
        {/* 未完了は常時表示、完了は「✓ 完了 (N)」で畳む（既定は折りたたみ） */}
        {activeTodos.length > 0 && (
          <ul className="mb-3 space-y-1">{activeTodos.map(renderTodoRow)}</ul>
        )}
        {doneTodos.length > 0 && (
          <div className="mb-3">
            <button
              onClick={toggleDoneOpen}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50"
            >
              {doneOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <Check className="h-4 w-4 text-emerald-500" strokeWidth={3} />
              <span>完了 ({doneTodos.length})</span>
            </button>
            {doneOpen && <ul className="mt-1 space-y-1">{doneTodos.map(renderTodoRow)}</ul>}
          </div>
        )}

        {/* タスク追加の入力 */}
        {addingTask && (
          <div className="mb-3 flex items-center gap-3 px-2">
            <span className="h-5 w-5 rounded-md border-2 border-zinc-300" />
            <input
              autoFocus
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitTask()}
              placeholder="タスクを入力して Enter"
              className="flex-1 bg-transparent text-zinc-700 outline-none placeholder:text-zinc-400"
            />
            <MicButton onText={(t) => setTaskText((p) => (p ? p + ' ' : '') + t)} />
          </div>
        )}
      </section>

      {/* 優先度の色の意味（左の色帯が何を表すか） */}
      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-400">
        <span className="font-medium text-zinc-500">優先度</span>
        <span className="flex items-center gap-1"><span className="h-3 w-1 rounded-full bg-red-500" />P0 今日</span>
        <span className="flex items-center gap-1"><span className="h-3 w-1 rounded-full bg-amber-400" />P1 今週</span>
        <span className="flex items-center gap-1"><span className="h-3 w-1 rounded-full bg-zinc-300" />P2以降</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-lantern" />今＝いま動かすゴール</span>
      </div>

      {/* === 大目標ごと（絶対目標は別格の見出し。配下だけツリーで編集できる） === */}
      {visionNodes.map((vision) => (
        <section key={vision.id} className="mt-10">
          <hr className="border-zinc-200" />
          <button onClick={() => navigate(`/goals/${vision.id}`)} className="block w-full py-5 text-left">
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-600">
              <Compass className="h-4 w-4" /> 大目標
            </div>
            <div className="mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">{vision.title}</div>
          </button>
          <hr className="border-zinc-200" />

          {/* この大目標の配下（スキルツリー） */}
          <div className="mt-4">
            <GoalTree
              tree={vision.children ?? []}
              users={users}
              onToggleTask={handleToggleTreeTask}
              onAddTask={addGoalTask}
              onAddGoal={createGoal}
              onAssignOwner={assignOwner}
              onOpenTask={(node) => setOpenTaskId(node.id)}
              onDeleteGoal={deleteGoal}
              onMove={setMoveItem}
              canEditGoals={canEditGoals}
            />

            {/* この大目標にゴールを追加（owner/admin のみ） */}
            {canEditGoals && (
              <div className="mt-1 flex items-center gap-3 rounded-lg py-2 pl-7 pr-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-white">
                  <Plus className="h-4 w-4" />
                </span>
                <input
                  value={addingGoalFor === vision.id ? goalText : ''}
                  maxLength={GOAL_MAX}
                  onFocus={() => setAddingGoalFor(vision.id)}
                  onChange={(e) => setGoalText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitGoal(vision.id)}
                  placeholder="この大目標の下に積むゴールを入力して Enter"
                  className="flex-1 bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
                />
                {addingGoalFor === vision.id && (
                  <MicButton onText={(t) => setGoalText((p) => (p ? p + ' ' : '') + t)} />
                )}
              </div>
            )}
          </div>
        </section>
      ))}

      {visionNodes.length === 0 && (
        <section className="mt-10">
          <hr className="mb-4 border-zinc-200" />
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-5 text-sm text-zinc-500">
            まだ大目標がありません。「事業設定」から大目標を追加すると、その下にゴールを積めます。
          </div>
        </section>
      )}

      {/* === 大目標に未分類のゴール（旧データの受け皿。消えないよう必ず表示） === */}
      {orphanNodes.length > 0 && (
        <section className="mt-10">
          <hr className="mb-4 border-zinc-200" />
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">大目標に未分類のゴール</h2>
          <GoalTree
            tree={orphanNodes}
            users={users}
            onToggleTask={handleToggleTreeTask}
            onAddTask={addGoalTask}
            onAddGoal={createGoal}
            onAssignOwner={assignOwner}
            onOpenTask={(node) => setOpenTaskId(node.id)}
            onDeleteGoal={deleteGoal}
            onMove={setMoveItem}
            canEditGoals={canEditGoals}
          />
        </section>
      )}

      <TaskDetailModal
        taskId={openTaskId}
        open={!!openTaskId}
        onClose={() => setOpenTaskId(null)}
        onSaved={() => {
          reloadTodos()
          reloadTree()
        }}
      />

      <MovePickerModal
        open={!!moveItem}
        item={moveItem}
        onClose={() => setMoveItem(null)}
        onMoved={() => {
          reloadTree()
          reloadTodos()
        }}
      />
    </div>
  )
}
