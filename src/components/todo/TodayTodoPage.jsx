import { useState } from 'react'
import {
  Plus,
  RotateCcw,
  Sparkles,
  Settings2,
  HelpCircle,
  Play,
  MoreHorizontal,
  LogIn,
  CalendarDays,
  X,
  Lightbulb,
  Check,
} from 'lucide-react'
import { useTodayTodo } from '../../hooks/useTodayTodo'
import { useGoals } from '../../hooks/useGoals'
import CalendarLinkModal from '../calendar/CalendarLinkModal'
import MicButton from '../common/MicButton'
import { useNavigate } from 'react-router-dom'

// 今日のToDo 画面 (/todo)。
export default function TodayTodoPage() {
  const { todos, claudeMessage, toggleTask, addTask } = useTodayTodo()
  const { topGoals, createGoal } = useGoals()
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(true)
  const [addingTask, setAddingTask] = useState(false)
  const [taskText, setTaskText] = useState('')
  const [goalText, setGoalText] = useState('')
  const navigate = useNavigate()

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
    <div className="relative mx-auto max-w-[1280px] px-10 py-8">
      {/* === 今日のToDo === */}
      <section>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">今日のToDo</h1>
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              Beta
            </span>
            <button
              onClick={() => setAddingTask((v) => !v)}
              className="text-zinc-400 hover:text-zinc-600"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          <div className="flex items-center gap-4 text-sm text-zinc-400">
            <button
              onClick={() => setCalendarOpen(true)}
              className="flex items-center gap-1.5 hover:text-zinc-600"
            >
              <CalendarDays className="h-4 w-4" />
              カレンダー連携
            </button>
            <button className="flex items-center gap-1.5 hover:text-zinc-600">
              <RotateCcw className="h-4 w-4" />
              今日のToDoを選び直す
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
                <span
                  className={
                    todo.status === 'done'
                      ? 'text-zinc-400 line-through'
                      : 'text-zinc-700'
                  }
                >
                  {todo.title}
                </span>
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

        <button className="flex items-center gap-2 py-2 font-medium text-claude hover:opacity-80">
          <Sparkles className="h-5 w-5" />
          Claudeと今日のToDoを決める
        </button>
      </section>

      {/* === 今やるべきゴール === */}
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">今やるべきゴール</h2>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1.5 rounded-full border border-claude/40 px-3 py-1.5 text-sm font-medium text-claude hover:bg-claude/5">
              <Sparkles className="h-4 w-4" />
              Claudeに相談
            </button>
            <button className="text-zinc-400 hover:text-zinc-600">
              <Settings2 className="h-5 w-5" />
            </button>
            <button className="text-zinc-400 hover:text-zinc-600">
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
        </div>

        <hr className="my-4 border-zinc-200" />

        <ul className="space-y-1">
          {topGoals.map((goal) => (
            <li
              key={goal.id}
              className="group flex items-center justify-between rounded-lg px-2 py-3 hover:bg-zinc-50"
            >
              <button
                onClick={() => navigate(`/goals/${goal.id}`)}
                className="flex items-center gap-4 text-left"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white">
                  <Play className="h-5 w-5 translate-x-0.5 fill-white" />
                </span>
                <span className="text-zinc-700">{goal.title}</span>
              </button>
              <div className="flex items-center gap-3 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
                <Plus className="h-5 w-5 hover:text-zinc-500" />
                <MoreHorizontal className="h-5 w-5 hover:text-zinc-500" />
                <LogIn className="h-5 w-5 hover:text-zinc-500" />
              </div>
            </li>
          ))}

          {/* ゴール作成の入力行 */}
          <li className="flex items-center gap-4 rounded-lg px-2 py-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white">
              <Play className="h-5 w-5 translate-x-0.5 fill-white" />
            </span>
            <input
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitGoal()}
              placeholder="達成したいゴールを入力して Enter"
              className="flex-1 bg-transparent text-zinc-700 outline-none placeholder:text-zinc-400"
            />
            <MicButton onText={(t) => setGoalText((p) => (p ? p + ' ' : '') + t)} />
          </li>
        </ul>
      </section>

      {/* Claudeトースト（右下） */}
      {toastOpen && (
        <div className="fixed bottom-6 right-20 flex items-center gap-3 rounded-lg bg-brand px-4 py-3 text-sm font-medium text-white shadow-lg">
          {claudeMessage}
          <button onClick={() => setToastOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ヒント（右下フローティング） */}
      <button className="fixed bottom-6 right-6 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-amber-500 shadow-md hover:bg-zinc-50">
        <Lightbulb className="h-5 w-5" />
      </button>

      <CalendarLinkModal
        open={calendarOpen}
        onClose={() => setCalendarOpen(false)}
      />
    </div>
  )
}
