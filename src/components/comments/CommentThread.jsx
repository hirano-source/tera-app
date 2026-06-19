import { useState } from 'react'
import { Send, Check, RotateCcw } from 'lucide-react'
import { useComments } from '../../hooks/useComments'
import { cn } from '../../utils/cn'

// ゴール/タスクのコメントスレッド（会話・相談・議事録の蓄積）。
// 投稿・解決済みトグルができる。ゴール詳細の常駐パネルとタスク詳細の両方で使う。
// Claude(MCP)も add_comment でここに「Claudeより」として書き込める。
export default function CommentThread({ targetType, targetId, className }) {
  const { comments, authors, addComment, toggleResolved, meId } = useComments(targetType, targetId)
  const [draft, setDraft] = useState('')

  const send = async () => {
    const v = draft.trim()
    if (!v) return
    await addComment(v)
    setDraft('')
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {comments.length === 0 ? (
          <p className="mt-8 text-center text-sm text-zinc-400">
            まだ会話がありません。経緯・相談・議事録をここに残すと、文脈が溜まっていきます。
          </p>
        ) : (
          comments.map((c) => {
            const mine = c.author_id === meId
            return (
              <div key={c.id} className={cn('group', c.resolved && 'opacity-60')}>
                <div className="mb-0.5 flex items-center gap-2 text-xs text-zinc-400">
                  <span className="font-medium text-zinc-500">{authors[c.author_id] ?? 'メンバー'}</span>
                  <span>{fmt(c.created_at)}</span>
                  {c.resolved && <span className="text-emerald-600">解決済み</span>}
                  <button
                    onClick={() => toggleResolved(c)}
                    title={c.resolved ? '未解決に戻す' : '解決済みにする'}
                    className="ml-auto rounded p-0.5 text-zinc-300 opacity-0 transition-opacity hover:bg-zinc-100 hover:text-zinc-600 group-hover:opacity-100"
                  >
                    {c.resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <div
                  className={cn(
                    'whitespace-pre-wrap rounded-lg px-3 py-2 text-sm',
                    mine ? 'bg-brand/10 text-zinc-800' : 'bg-zinc-100 text-zinc-800',
                  )}
                >
                  {c.body}
                </div>
              </div>
            )
          })
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-zinc-200 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="コメント・議事録を入力…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
        />
        <button
          onClick={send}
          disabled={!draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
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
