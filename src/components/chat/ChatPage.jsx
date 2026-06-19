import { useState } from 'react'
import { Search, BookText, Send, Target } from 'lucide-react'
import { useChat } from '../../hooks/useChat'
import { useWorkspace } from '../../hooks/useWorkspace'
import { cn } from '../../utils/cn'
import MicButton from '../common/MicButton'

// チャット 画面 (/chat)。ゴール＝スレッド。左に一覧、右にメッセージ。
export default function ChatPage() {
  const { workspace, current } = useWorkspace()
  const [selected, setSelected] = useState(null)
  const { threads, messages, authors, sendMessage, meId } = useChat(selected?.id)
  const [text, setText] = useState('')

  const send = async () => {
    if (!text.trim()) return
    await sendMessage(text)
    setText('')
  }

  return (
    <div className="flex h-full flex-col sm:flex-row">
      {/* 左: スレッド一覧（ゴール）。モバイルは上に積んで高さを抑える */}
      <aside className="flex max-h-[40vh] w-full shrink-0 flex-col border-b border-zinc-200 sm:max-h-none sm:w-[340px] sm:border-b-0 sm:border-r">
        <div className="flex items-center gap-2 px-5 py-4">
          <BookText className="h-5 w-5 text-zinc-500" />
          <h1 className="text-lg font-bold">{current?.name ?? workspace?.name}</h1>
        </div>
        <div className="px-4">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-400">
            <Search className="h-4 w-4" />
            チャットを検索
          </div>
        </div>
        <div className="mt-3 flex-1 overflow-y-auto px-2">
          {threads.length === 0 ? (
            <p className="mt-10 text-center text-sm text-zinc-400">
              ゴールを作るとスレッドができます
            </p>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm',
                  selected?.id === t.id ? 'bg-zinc-100' : 'hover:bg-zinc-50',
                )}
              >
                <Target className="h-4 w-4 shrink-0 text-brand" />
                <span className="truncate text-zinc-700">{t.title}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* 右: メッセージ */}
      <div className="flex min-w-0 flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-zinc-400">
            ゴールを選択するとスレッドが表示されます
          </div>
        ) : (
          <>
            <div className="border-b border-zinc-200 px-6 py-3 font-bold">
              {selected.title}
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
              {messages.length === 0 ? (
                <p className="mt-10 text-center text-sm text-zinc-400">
                  まだメッセージがありません。最初の一言を送りましょう。
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.author_id === meId
                  return (
                    <div key={m.id} className={cn('flex', mine && 'justify-end')}>
                      <div className="max-w-[70%]">
                        {!mine && (
                          <p className="mb-0.5 text-xs text-zinc-400">
                            {authors[m.author_id] ?? 'メンバー'}
                          </p>
                        )}
                        <div
                          className={cn(
                            'rounded-2xl px-3.5 py-2 text-sm',
                            mine ? 'bg-brand text-white' : 'bg-zinc-100 text-zinc-800',
                          )}
                        >
                          {m.body}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <div className="flex items-center gap-2 border-t border-zinc-200 px-4 py-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send()}
                placeholder="メッセージを入力…"
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
              />
              <MicButton onText={(t) => setText((p) => (p ? p + ' ' : '') + t)} />
              <button
                onClick={send}
                disabled={!text.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-white hover:opacity-90 disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
