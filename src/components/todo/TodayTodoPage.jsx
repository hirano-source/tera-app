import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Check, ChevronRight, Trash2, Compass } from 'lucide-react'
import { useTodayTodo } from '../../hooks/useTodayTodo'
import { useGoalTree } from '../../hooks/useGoalTree'
import { useWorkspace } from '../../hooks/useWorkspace'
import GoalTree from '../goals/GoalTree'
import MicButton from '../common/MicButton'
import TaskDetailModal from '../tasks/TaskDetailModal'
import TaskMeta from '../tasks/TaskMeta'

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
  const [openTaskId, setOpenTaskId] = useState(null)
  const navigate = useNavigate()

  // 大目標は「絶対目標」なのでツリーに入れず別格表示にする。
  // ツリーには大目標の配下（子ゴール／タスク）だけを渡す。
  const visionGoalId = current?.visionGoalId ?? null
  const visionNode = tree.find((n) => n.id === visionGoalId) ?? null
  const displayTree = visionGoalId
    ? tree.flatMap((n) => (n.id === visionGoalId ? n.children : [n]))
    : tree

  const submitTask = async () => {
    await addTask(taskText)
    setTaskText('')
    setAddingTask(false)
  }
  const submitGoal = async () => {
    await createGoal(goalText)
    setGoalText('')
  }

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
        {todos.length > 0 && (
          <ul className="mb-3 space-y-1">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-zinc-50"
              >
                <button
                  onClick={() => toggleTask(todo)}
                  className={
                    todo.status === 'done'
                      ? 'flex h-5 w-5 items-center justify-center rounded-md bg-emerald-500 text-white'
                      : 'h-5 w-5 rounded-md border-2 border-zinc-300 hover:border-emerald-400'
                  }
                >
                  {todo.status === 'done' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </button>
                <button
                  onClick={() => setOpenTaskId(todo.id)}
                  className={
                    'min-w-0 flex-1 truncate text-left ' +
                    (todo.status === 'done' ? 'text-zinc-400 line-through' : 'text-zinc-700')
                  }
                >
                  {todo.title}
                </button>
                <TaskMeta task={todo} />
                <button
                  onClick={() => setOpenTaskId(todo.id)}
                  title="詳細を開く"
                  className="shrink-0 rounded-md p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                {(canEditGoals || todo.assignee_id === user?.id) && (
                  <button
                    onClick={() => {
                      if (confirm(`タスク「${todo.title}」を削除しますか？`)) deleteTask(todo)
                    }}
                    title="削除"
                    className="shrink-0 rounded-md p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
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

      {/* === 大目標（絶対目標・ツリーには入れず別格でデカく） === */}
      {visionNode && (
        <section className="mt-10">
          <hr className="border-zinc-200" />
          <button
            onClick={() => navigate(`/goals/${visionNode.id}`)}
            className="block w-full py-5 text-left"
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-amber-600">
              <Compass className="h-4 w-4" /> 大目標
            </div>
            <div className="mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">{visionNode.title}</div>
          </button>
          <hr className="border-zinc-200" />
        </section>
      )}

      {/* === ゴール階層（スキルツリー＝大目標の配下だけ） === */}
      <section className={visionNode ? 'mt-6' : 'mt-10'}>
        {!visionNode && <hr className="mb-4 border-zinc-200" />}

        {/* スキルツリー（ゴール階層） */}
        <GoalTree
          tree={displayTree}
          users={users}
          onToggleTask={toggleGoalTask}
          onAddTask={addGoalTask}
          onAddGoal={createGoal}
          onAssignOwner={assignOwner}
          onOpenTask={(node) => setOpenTaskId(node.id)}
          onDeleteGoal={deleteGoal}
          canEditGoals={canEditGoals}
        />

        {/* ゴール作成の入力行（owner/admin のみ） */}
        {canEditGoals && (
          <div className="mt-1 flex items-center gap-3 rounded-lg py-2 pl-7 pr-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <Plus className="h-4 w-4" />
            </span>
            <input
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitGoal()}
              placeholder="達成したいゴールを入力して Enter"
              className="flex-1 bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
            />
            <MicButton onText={(t) => setGoalText((p) => (p ? p + ' ' : '') + t)} />
          </div>
        )}
      </section>

      <TaskDetailModal
        taskId={openTaskId}
        open={!!openTaskId}
        onClose={() => setOpenTaskId(null)}
        onSaved={() => {
          reloadTodos()
          reloadTree()
        }}
      />
    </div>
  )
}
