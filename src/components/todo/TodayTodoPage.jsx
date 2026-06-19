import { useState } from 'react'
import { Plus, Settings2, HelpCircle, Check, ChevronRight } from 'lucide-react'
import { useTodayTodo } from '../../hooks/useTodayTodo'
import { useGoalTree } from '../../hooks/useGoalTree'
import { useWorkspace } from '../../hooks/useWorkspace'
import GoalTree from '../goals/GoalTree'
import MicButton from '../common/MicButton'
import TaskDetailModal from '../tasks/TaskDetailModal'
import TaskMeta from '../tasks/TaskMeta'

// 今日のToDo 画面 (/todo)。
export default function TodayTodoPage() {
  const { current } = useWorkspace()
  const canEditGoals = ['owner', 'admin'].includes(current?.role)
  const { todos, toggleTask, addTask, reload: reloadTodos } = useTodayTodo()
  const {
    tree,
    users,
    createGoal,
    addTask: addGoalTask,
    toggleTask: toggleGoalTask,
    assignOwner,
    reload: reloadTree,
  } = useGoalTree()
  const [addingTask, setAddingTask] = useState(false)
  const [taskText, setTaskText] = useState('')
  const [goalText, setGoalText] = useState('')
  const [openTaskId, setOpenTaskId] = useState(null)

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
                      ? 'flex h-5 w-5 items-center justify-center rounded-md bg-brand text-white'
                      : 'h-5 w-5 rounded-md border-2 border-zinc-300 hover:border-brand'
                  }
                >
                  {todo.status === 'done' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </button>
                <button
                  onClick={() => setOpenTaskId(todo.id)}
                  className={
                    'flex-1 truncate text-left ' +
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

      {/* === 今やるべきゴール === */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">今やるべきゴール</h2>
          <div className="flex items-center gap-3">
            <button className="text-zinc-400 hover:text-zinc-600">
              <Settings2 className="h-5 w-5" />
            </button>
            <button className="text-zinc-400 hover:text-zinc-600">
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
        </div>

        <hr className="my-4 border-zinc-200" />

        {/* スキルツリー（ゴール階層） */}
        <GoalTree
          tree={tree}
          users={users}
          onToggleTask={toggleGoalTask}
          onAddTask={addGoalTask}
          onAddGoal={createGoal}
          onAssignOwner={assignOwner}
          onOpenTask={(node) => setOpenTaskId(node.id)}
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
