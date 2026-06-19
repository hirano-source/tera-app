import { useState } from 'react'
import { Filter, ArrowDown } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { cn } from '../../utils/cn'

// 通知 画面 (/notifications)。左に一覧、右に詳細の2ペイン。
export default function NotificationsPage() {
  const { notifications } = useNotifications()
  const [tab, setTab] = useState('すべて')

  return (
    <div className="flex h-full gap-4 bg-zinc-50 p-4">
      {/* 左: 一覧 */}
      <section className="flex w-[420px] shrink-0 flex-col">
        <div className="flex items-center gap-2">
          <div className="flex rounded-full bg-zinc-200/70 p-0.5 text-sm">
            {['未読', 'すべて'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-full px-4 py-1 font-medium transition-colors',
                  tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-500',
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-500">
            <Filter className="h-4 w-4" />
            フィルター
          </button>
          <button className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-500">
            <ArrowDown className="h-4 w-4" />
            新しい順
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center">
          {notifications.length === 0 && (
            <p className="text-zinc-400">通知はありません</p>
          )}
        </div>
      </section>

      {/* 右: 詳細 */}
      <section className="flex flex-1 items-center justify-center rounded-2xl border border-zinc-200 bg-white">
        <p className="text-zinc-400">通知はありません</p>
      </section>
    </div>
  )
}
