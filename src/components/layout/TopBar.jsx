import { useState } from 'react'
import { Search, ChevronDown, Check, Plus } from 'lucide-react'
import { useWorkspace } from '../../hooks/useWorkspace'

// 上部バー（ダーク）。左に事業（ワークスペース）切替、中央に検索、右にポイント。
export default function TopBar() {
  const { workspaces, current, setCurrent, createBusiness } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const v = name.trim()
    if (!v || busy) return
    setBusy(true)
    try {
      await createBusiness(v)
      setName('')
      setAdding(false)
      setOpen(false)
    } catch (e) {
      alert('事業の作成に失敗しました: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

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

            <div className="my-1 border-t border-zinc-100" />

            {adding ? (
              <div className="flex items-center gap-1 px-1.5 py-1">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit()
                    if (e.key === 'Escape') { setAdding(false); setName('') }
                  }}
                  placeholder="事業の名前"
                  disabled={busy}
                  className="min-w-0 flex-1 rounded-md border border-zinc-200 px-2 py-1.5 text-sm text-zinc-700 outline-none focus:border-brand"
                />
                <button
                  onClick={submit}
                  disabled={busy || !name.trim()}
                  className="shrink-0 rounded-md bg-brand px-2.5 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  {busy ? '…' : '作成'}
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-brand hover:bg-zinc-50"
              >
                <Plus className="h-4 w-4" />
                事業を追加
              </button>
            )}
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
    </header>
  )
}
