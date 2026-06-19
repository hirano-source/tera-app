import { useParams } from 'react-router-dom'
import {
  ChevronDown,
  Plus,
  Headphones,
  Flag,
  UserPlus,
  MoreHorizontal,
  Search,
  ArrowUpDown,
  Upload,
  ChevronRight,
  MessageSquare,
  Menu,
} from 'lucide-react'
import { useGoal } from '../../hooks/useGoals'
import { useWorkspace } from '../../hooks/useWorkspace'

// ゴール詳細 画面 (/goals/:id)。
export default function GoalDetailPage() {
  const { goalId } = useParams()
  const { goal, loading } = useGoal(goalId)
  const { user } = useWorkspace()

  if (loading || !goal) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        読み込み中…
      </div>
    )
  }

  return (
    <div className="relative mx-auto max-w-[1280px] px-8 py-5">
      {/* ツールバー */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button className="text-zinc-500 hover:text-zinc-800">
            <Menu className="h-6 w-6" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-2 py-1 text-sm">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: user.color }}
            >
              {user.initial}
            </span>
            {user.name}
            <UserPlus className="ml-1 h-4 w-4 text-zinc-400" />
          </span>
          <button className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100">
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* アクションバー */}
      <div className="flex items-center gap-2 text-sm">
        <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-zinc-100">
          <Plus className="h-4 w-4" />
          現状
        </button>
        <button className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-zinc-100">
          <Plus className="h-4 w-4" />
          完了の基準
        </button>
        <button className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-1.5 text-zinc-600 hover:bg-zinc-100">
          <Headphones className="h-4 w-4" />
          ハドルを開始
          <ChevronDown className="h-4 w-4" />
        </button>
        <button className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-zinc-600 hover:bg-zinc-100">
          <Flag className="h-4 w-4" />
          期日を設定
        </button>
      </div>

      {/* タイトル */}
      <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/60 px-6 py-8 text-center">
        <h1 className="text-3xl font-bold tracking-wide">{goal.title}</h1>
      </div>

      {/* サブタスク入力 */}
      <div className="mt-6 flex items-center gap-3 rounded-xl border border-zinc-200 px-5 py-4 text-zinc-400">
        <Plus className="h-5 w-5" />
        タイトルを「〜する」の形で入力
      </div>

      {/* リソース */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ChevronDown className="h-5 w-5" />
          リソース
        </h2>

        <div className="mt-3 flex gap-6 rounded-xl border border-zinc-200 p-4">
          {/* 左ペイン: ツリー */}
          <aside className="w-56 shrink-0 border-r border-zinc-100 pr-4">
            <div className="rounded-lg bg-zinc-100 px-3 py-2 text-sm font-medium">
              {goal.title} の<br />リソース
            </div>
            <p className="mt-3 px-3 text-xs text-zinc-400">リソースがありません</p>
            <button className="mt-3 flex items-center gap-1.5 px-1 text-sm text-zinc-500 hover:text-zinc-800">
              <ChevronRight className="h-4 w-4" />
              配下のリソース
            </button>
          </aside>

          {/* 右ペイン: 一覧 */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{goal.title}</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-400">
                  <Search className="h-4 w-4" />
                  検索
                </div>
                <button className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-600">
                  <ArrowUpDown className="h-4 w-4" />
                  名前
                </button>
                <button className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white">
                  <Plus className="h-4 w-4" />
                  新規作成
                </button>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-[1fr_120px_100px] border-b border-zinc-100 pb-2 text-xs text-zinc-400">
              <span>名前</span>
              <span className="text-right">更新日</span>
              <span className="text-right">種類</span>
            </div>

            {/* 空状態 */}
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 text-zinc-300">
                <Upload className="h-8 w-8" />
              </div>
              <p className="mt-4 font-bold text-zinc-600">成果物がありません</p>
              <p className="mt-1 text-sm text-zinc-400">
                ファイルをここにドラッグ&ドロップ、または「新規作成」から追加
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* コメント（右下） */}
      <button className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
        <MessageSquare className="h-4 w-4" />
        0件
      </button>
    </div>
  )
}
