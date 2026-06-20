import { useRef, useState } from 'react'
import { Send, Check, RotateCcw } from 'lucide-react'
import { useComments } from '../../hooks/useComments'
import { cn } from '../../utils/cn'
import RecordButton from './RecordButton'

// ゴール/タスクのコメントスレッド（会話・相談・議事録の蓄積）。
// 投稿・解決済みトグル・@メンション（指名→通知）ができる。
// members を渡すと @ で候補が出る。Claude(MCP)も add_comment でここに書ける。
export default function CommentThread({ targetType, targetId, members = [], className }) {
  const { comments, authors, addComment, toggleResolved, meId } = useComments(targetType, targetId)
  const [draft, setDraft] = useState('')
  const [mentionedIds, setMentionedIds] = useState([])
  const [mentionQuery, setMentionQuery] = useState(null) // null=閉じてる
  const inputRef = useRef(null)

  const filteredMembers =
    mentionQuery === null
      ? []
      : members.filter((m) => m.name && m.name.toLowerCase().includes(mentionQuery.toLowerCase()))

  const onChange = (e) => {
    const val = e.target.value
    setDraft(val)
    const pos = e.target.selectionStart ?? val.length
    const upto = val.slice(0, pos)
    const at = upto.lastIndexOf('@')
    if (at >= 0 && !/\s/.test(upto.slice(at + 1))) setMentionQuery(upto.slice(at + 1))
    else setMentionQuery(null)
  }

  const selectMention = (m) => {
    const pos = inputRef.current?.selectionStart ?? draft.length
    const upto = draft.slice(0, pos)
    const at = upto.lastIndexOf('@')
    if (at < 0) return
    const next = `${draft.slice(0, at)}@${m.name} ${draft.slice(pos)}`
    setDraft(next)
    setMentionedIds((ids) => (ids.includes(m.id) ? ids : [...ids, m.id]))
    setMentionQuery(null)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const send = async () => {
    const v = draft.trim()
    if (!v) return
    // 本文に「@名前」が残っている指名だけを通知対象にする
    const active = mentionedIds.filter((id) => {
      const m = members.find((x) => x.id === id)
      return m && v.includes('@' + m.name)
    })
    await addComment(v, active)
    setDraft('')
    setMentionedIds([])
    setMentionQuery(null)
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
                  {renderBody(c.body, members)}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="relative border-t border-zinc-200 p-3">
        {/* @メンション候補 */}
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className="absolute bottom-full left-3 right-3 mb-1 max-h-44 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
            {filteredMembers.map((m) => (
              <button
                key={m.id}
                onClick={() => selectMention(m)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-zinc-50"
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ backgroundColor: m.avatar_color || '#6d5dfc' }}
                >
                  {(m.name || '?').charAt(0).toUpperCase()}
                </span>
                <span className="truncate text-zinc-700">{m.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <RecordButton onResult={(summary) => summary && addComment(summary)} />
          <input
            ref={inputRef}
            value={draft}
            onChange={onChange}
            onKeyDown={(e) => e.key === 'Enter' && mentionQuery === null && send()}
            placeholder="コメント・議事録を入力（@で指名 / 🎤で録音→要約投稿）…"
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
    </div>
  )
}

// 本文中の「@名前」をハイライト表示する
function renderBody(body, members) {
  if (!members?.length) return body
  const tokens = members
    .map((m) => m.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((n) => '@' + n)
  const parts = []
  let i = 0
  let key = 0
  while (i < body.length) {
    let matched = null
    if (body[i] === '@') {
      for (const tok of tokens) {
        if (body.startsWith(tok, i)) {
          matched = tok
          break
        }
      }
    }
    if (matched) {
      parts.push(
        <span key={key++} className="rounded bg-brand/15 px-1 font-medium text-brand">
          {matched}
        </span>,
      )
      i += matched.length
    } else {
      let j = body.indexOf('@', i + 1)
      if (j === -1) j = body.length
      parts.push(body.slice(i, j))
      i = j
    }
  }
  return parts
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
