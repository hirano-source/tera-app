import { useNavigate } from 'react-router-dom'
import { Target, Play, Plus } from 'lucide-react'
import { useGoals } from '../../hooks/useGoals'

// ゴール一覧 画面 (/goals)。各ゴールから詳細へ遷移する。
export default function GoalsListPage() {
  const { goals } = useGoals()
  const navigate = useNavigate()

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-10 sm:py-8">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Target className="h-6 w-6" />
          ゴール
        </h1>
        <button className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white">
          <Plus className="h-4 w-4" />
          ゴールを追加
        </button>
      </div>

      <hr className="my-4 border-zinc-200" />

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
      </ul>
    </div>
  )
}
