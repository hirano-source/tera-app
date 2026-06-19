import { useState } from 'react'
import { Search, BookText } from 'lucide-react'
import { useChat } from '../../hooks/useChat'
import { useWorkspace } from '../../hooks/useWorkspace'
import { cn } from '../../utils/cn'

// チャット 画面 (/chat)。左にスレッド一覧、右にスレッド本体。
export default function ChatPage() {
  const { tabs, threads } = useChat()
  const { workspace } = useWorkspace()
  const [activeTab, setActiveTab] = useState(tabs[0].key)

  return (
    <div className="flex h-full">
      {/* 左: スレッド一覧 */}
      <aside className="flex w-[360px] shrink-0 flex-col border-r border-zinc-200">
        <div className="flex items-center gap-2 px-5 py-4">
          <BookText className="h-5 w-5 text-zinc-500" />
          <h1 className="text-lg font-bold">{workspace.name}</h1>
        </div>

        <div className="px-4">
          <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-400">
            <Search className="h-4 w-4" />
            チャットを検索
          </div>
        </div>

        <div className="flex gap-2 px-4 py-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                activeTab === tab.key
                  ? 'bg-brand text-white'
                  : 'text-zinc-500 hover:bg-zinc-100',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {threads.length === 0 ? (
            <p className="mt-10 text-center text-sm text-zinc-400">
              今日のToDoがありません
            </p>
          ) : null}
        </div>
      </aside>

      {/* 右: スレッド本体 */}
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-400">ゴールを選択するとスレッドが表示されます</p>
      </div>
    </div>
  )
}
