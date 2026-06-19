import { useState } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'
import { useWorkspace } from '../../hooks/useWorkspace'

// 上部バー（ダーク）。左にワークスペース切替、中央に検索、右にポイント。
export default function TopBar({ points }) {
  const { workspaces, current, setCurrent } = useWorkspace()
  const [open, setOpen] = useState(false)

  return (
    <header className="flex h-[60px] shrink-0 items-center gap-3 px-4">
      {/* 左: ワークスペース切替 */}
      <div className="relative shrink-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-zinc-200 hover:bg-white/10"
        >
          <span className="max-w-[150px] truncate font-medium">
            {current?.name ?? '…'}
          </span>
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        </button>
        {open && (
          <div className="absolute left-0 top-11 z-20 w-56 rounded-xl border border-zinc-200 bg-white p-1 shadow-xl">
            {workspaces.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setCurrent(w.id)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-50"
              >
                <span className="truncate text-zinc-700">{w.name}</span>
                {current?.id === w.id && <Check className="h-4 w-4 text-brand" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 中央: 検索 */}
      <div className="flex flex-1 justify-center">
        <div className="flex w-full max-w-[640px] items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-zinc-300">
          <Search className="h-4 w-4" />
          <span className="text-sm">検索</span>
        </div>
      </div>

      {/* 右: ポイント */}
      <div className="flex shrink-0 items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-zinc-200">
        <span className="text-base">🪙</span>
        <span className="font-semibold">{points}</span>
      </div>
    </header>
  )
}
