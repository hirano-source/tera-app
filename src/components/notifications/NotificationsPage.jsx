import { useState, useMemo } from 'react'
import { ArrowDown, ArrowUp, CheckCheck, Bell } from 'lucide-react'
import { useNotifications } from '../../hooks/useNotifications'
import { cn } from '../../utils/cn'

// 通知 画面 (/notifications)。左に一覧、右に詳細の2ペイン。
// notifications テーブルの実データ。未読/すべての絞り込み・並べ替え・既読化が動く。
export default function NotificationsPage() {
  const { notifications, markRead, markAllRead, unreadCount } = useNotifications()
  const [tab, setTab] = useState('すべて')
  const [newest, setNewest] = useState(true)
  const [selected, setSelected] = useState(null)

  const list = useMemo(() => {
    const filtered = tab === '未読' ? notifications.filter((n) => !n.read) : notifications
    return [...filtered].sort((a, b) =>
      newest
        ? new Date(b.created_at) - new Date(a.created_at)
        : new Date(a.created_at) - new Date(b.created_at),
    )
  }, [notifications, tab, newest])

  const open = (n) => {
    setSelected(n)
    if (!n.read) markRead(n.id)
  }

  return (
    <div className="flex h-full flex-col gap-4 bg-zinc-50 p-4 sm:flex-row">
      {/* 左: 一覧。モバイルは縦積み */}
      <section className="flex w-full shrink-0 flex-col sm:w-[420px]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-full bg-zinc-200/70 p-0.5 text-sm">
            {['未読', 'すべて'].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-1 rounded-full px-4 py-1 font-medium transition-colors',
                  tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-500',
                )}
              >
                {t}
                {t === '未読' && unreadCount > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-[11px] text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={() => setNewest((v) => !v)}
            className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50"
          >
            {newest ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
            {newest ? '新しい順' : '古い順'}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-500 hover:bg-zinc-50"
            >
              <CheckCheck className="h-4 w-4" />
              すべて既読
            </button>
          )}
        </div>

        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto">
          {list.length === 0 ? (
            <p className="mt-16 text-center text-zinc-400">通知はありません</p>
          ) : (
            list.map((n) => {
              const { title, body } = describe(n)
              return (
                <button
                  key={n.id}
                  onClick={() => open(n)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border bg-white p-3 text-left transition-colors hover:bg-zinc-50',
                    selected?.id === n.id ? 'border-brand' : 'border-zinc-200',
                  )}
                >
                  <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                    <Bell className="h-4 w-4" />
                    {!n.read && (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', n.read ? 'text-zinc-600' : 'font-semibold text-zinc-800')}>
                      {title}
                    </span>
                    {body && <span className="block truncate text-xs text-zinc-500">{body}</span>}
                    <span className="mt-0.5 block text-[11px] text-zinc-400">{fmt(n.created_at)}</span>
                  </span>
                </button>
              )
            })
          )}
        </div>
      </section>

      {/* 右: 詳細 */}
      <section className="hidden flex-1 items-center justify-center rounded-2xl border border-zinc-200 bg-white sm:flex">
        {selected ? (
          <div className="max-w-md px-8 py-10 text-center">
            <Bell className="mx-auto h-10 w-10 text-zinc-300" />
            <p className="mt-4 text-lg font-bold text-zinc-700">{describe(selected).title}</p>
            {describe(selected).body && (
              <p className="mt-2 text-sm text-zinc-500">{describe(selected).body}</p>
            )}
            <p className="mt-3 text-xs text-zinc-400">{fmt(selected.created_at)}</p>
          </div>
        ) : (
          <p className="text-zinc-400">通知を選択すると内容が表示されます</p>
        )}
      </section>
    </div>
  )
}

// 通知タイプ → 表示文言。未知タイプはそのまま出す。
function describe(n) {
  const p = n.payload || {}
  switch (n.type) {
    case 'task_assigned':
      return {
        title: '新しいタスクが割り当てられました',
        body: [p.title ? `「${p.title}」` : '', p.by ? `（${p.by} さんから）` : ''].join(' ').trim(),
      }
    case 'mention':
      return {
        title: 'コメントで指名されました',
        body: [p.excerpt ? `「${p.excerpt}」` : '', p.by ? `（${p.by} さんから）` : ''].join(' ').trim(),
      }
    default:
      return { title: n.type, body: typeof p?.title === 'string' ? p.title : '' }
  }
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
