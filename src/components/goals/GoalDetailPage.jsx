import { useRef, useState, useMemo } from 'react'
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
  Download,
  Trash2,
  FileText,
  X,
  Send,
} from 'lucide-react'
import { useGoal } from '../../hooks/useGoals'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useDeliverables } from '../../hooks/useDeliverables'
import { useComments } from '../../hooks/useComments'
import { cn } from '../../utils/cn'

// ゴール詳細 画面 (/goals/:id)。成果物（ファイル）とコメントが実際に動く。
export default function GoalDetailPage() {
  const { goalId } = useParams()
  const { goal, loading } = useGoal(goalId)
  const { user } = useWorkspace()
  const { items, available, busy, upload, download, remove } = useDeliverables(goalId)
  const { comments, authors, addComment, count: commentCount, meId } = useComments('goal', goalId)

  const fileRef = useRef(null)
  const [q, setQ] = useState('')
  const [asc, setAsc] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const shown = useMemo(() => {
    const f = items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))
    return [...f].sort((a, b) => (asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)))
  }, [items, q, asc])

  if (loading || !goal) {
    return (
      <div className="flex h-full items-center justify-center text-zinc-400">
        読み込み中…
      </div>
    )
  }

  const onPick = (e) => {
    const f = e.target.files?.[0]
    if (f) upload(f)
    e.target.value = ''
  }
  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (!available) return
    const f = e.dataTransfer.files?.[0]
    if (f) upload(f)
  }
  const sendComment = async () => {
    const v = draft.trim()
    if (!v) return
    await addComment(v)
    setDraft('')
  }

  return (
    <div className="relative mx-auto max-w-[1280px] px-4 py-5 sm:px-8">
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

      {/* 成果物 */}
      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <ChevronDown className="h-5 w-5" />
          成果物
        </h2>

        <div
          className={cn(
            'mt-3 rounded-xl border p-4 transition-colors',
            dragOver ? 'border-brand bg-brand/5' : 'border-zinc-200',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            if (available) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {/* ヘッダ: 検索・並べ替え・新規作成 */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-medium">{goal.title}</h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-500 focus-within:border-zinc-400">
                <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="検索"
                  className="w-24 min-w-0 bg-transparent outline-none placeholder:text-zinc-400"
                />
              </div>
              <button
                onClick={() => setAsc((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                <ArrowUpDown className="h-4 w-4" />
                {asc ? '名前↑' : '名前↓'}
              </button>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={!available || busy}
                className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
                {busy ? 'アップロード中…' : '新規作成'}
              </button>
              <input ref={fileRef} type="file" onChange={onPick} className="hidden" />
            </div>
          </div>

          {!available ? (
            // テーブル/バケット未作成のときの案内（壊さず静かに無効化）
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-amber-200 text-amber-400">
                <Upload className="h-7 w-7" />
              </div>
              <p className="mt-4 font-bold text-zinc-600">成果物機能はまだ無効です</p>
              <p className="mt-1 max-w-sm text-sm text-zinc-400">
                <code className="rounded bg-zinc-100 px-1">db/deliverables.sql</code>{' '}
                を Supabase の SQL Editor で一度実行すると、ファイルのアップロードが有効になります。
              </p>
            </div>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-[1fr_92px] gap-2 border-b border-zinc-100 pb-2 text-xs text-zinc-400 sm:grid-cols-[1fr_140px_80px]">
                <span>名前</span>
                <span className="hidden text-right sm:block">更新日</span>
                <span className="text-right">操作</span>
              </div>

              {shown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 text-zinc-300">
                    <Upload className="h-7 w-7" />
                  </div>
                  <p className="mt-4 font-bold text-zinc-600">
                    {q ? '一致する成果物がありません' : '成果物がありません'}
                  </p>
                  {!q && (
                    <p className="mt-1 text-sm text-zinc-400">
                      ファイルをここにドラッグ&ドロップ、または「新規作成」から追加
                    </p>
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {shown.map((d) => (
                    <li
                      key={d.id}
                      className="grid grid-cols-[1fr_92px] items-center gap-2 py-2.5 text-sm sm:grid-cols-[1fr_140px_80px]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                        <span className="truncate text-zinc-700">{d.name}</span>
                      </span>
                      <span className="hidden text-right text-xs text-zinc-400 sm:block">
                        {fmt(d.created_at)}
                      </span>
                      <span className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => download(d)}
                          title="ダウンロード"
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(d)}
                          title="削除"
                          className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      {/* コメント（右下FAB） */}
      <button
        onClick={() => setCommentsOpen(true)}
        className="fixed bottom-6 right-6 z-20 flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:opacity-90"
      >
        <MessageSquare className="h-4 w-4" />
        {commentCount}件
      </button>

      {/* コメントドロワー */}
      {commentsOpen && (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/30" onClick={() => setCommentsOpen(false)}>
          <div
            className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h3 className="flex items-center gap-2 font-bold">
                <MessageSquare className="h-5 w-5 text-zinc-500" />
                コメント
              </h3>
              <button onClick={() => setCommentsOpen(false)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {comments.length === 0 ? (
                <p className="mt-10 text-center text-sm text-zinc-400">
                  まだコメントがありません。経緯や詰まりを残しましょう。
                </p>
              ) : (
                comments.map((c) => {
                  const mine = c.author_id === meId
                  return (
                    <div key={c.id} className={cn('flex flex-col', mine && 'items-end')}>
                      <span className="mb-0.5 text-xs text-zinc-400">
                        {authors[c.author_id] ?? 'メンバー'}・{fmt(c.created_at)}
                      </span>
                      <div
                        className={cn(
                          'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm',
                          mine ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-800',
                        )}
                      >
                        {c.body}
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-zinc-200 px-4 py-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendComment()}
                placeholder="コメントを入力…"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
              />
              <button
                onClick={sendComment}
                disabled={!draft.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
