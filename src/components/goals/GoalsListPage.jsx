import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, Play, Plus } from 'lucide-react'
import { useGoals } from '../../hooks/useGoals'

// ゴール一覧 画面 (/goals)。各ゴールから詳細へ遷移する。追加もできる。
export default function GoalsListPage() {
  const { goals, createGoal } = useGoals()
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')

  const submit = async () => {
    const v = title.trim()
    if (!v) return
    await createGoal(v)
    setTitle('')
    setAdding(false)
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Target className="h-6 w-6" />
          ゴール
        </h1>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          ゴールを追加
        </button>
      </div>

      <hr className="my-4 border-zinc-200" />

      {adding && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <Plus className="h-4 w-4" />
          </span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') {
                setAdding(false)
                setTitle('')
              }
            }}
            placeholder="達成したいゴールを入力して Enter"
            className="flex-1 bg-transparent text-zinc-700 outline-none placeholder:text-zinc-400"
          />
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            追加
          </button>
        </div>
      )}

      <ul className="space-y-1">
        {goals.map((goal) => (
          <li key={goal.id}>
            <button
              onClick={() => navigate(`/goals/${goal.id}`)}
              className="flex w-full items-center gap-4 rounded-lg px-2 py-3 text-left hover:bg-zinc-50"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white">
                <Play className="h-5 w-5 translate-x-0.5 fill-white" />
              </span>
              <span className="text-zinc-700">{goal.title}</span>
            </button>
          </li>
        ))}
        {goals.length === 0 && !adding && (
          <li className="py-12 text-center text-sm text-zinc-400">
            まだゴールがありません。「ゴールを追加」から作成できます。
          </li>
        )}
      </ul>
    </div>
  )
}
