import { useState } from 'react'
import { ChevronDown, Check, Plus, Trash2, Settings, RefreshCw } from 'lucide-react'
import { useWorkspace } from '../../hooks/useWorkspace'
import SearchBox from './SearchBox'

// 上部バー（ダーク）。左に事業（ワークスペース）切替、中央に検索、右にポイント。
export default function TopBar({ onOpenBusiness }) {
  const { workspaces, current, setCurrent, createBusiness, deleteBusiness } = useWorkspace()
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

  const remove = async (w) => {
    if (
      !confirm(
        `事業「${w.name}」を削除しますか？\nこの事業のゴール・タスク・コメント・成果物などもすべて削除され、元に戻せません。`,
      )
    )
      return
    try {
      await deleteBusiness(w.id)
      setOpen(false)
    } catch (e) {
      alert('事業の削除に失敗しました: ' + (e?.message ?? e))
    }
  }

  return (
    <header
      className="flex shrink-0 flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="flex h-[60px] items-center gap-3 px-4">
      {/* ロゴ（タップで事業設定）。スマホでもここから入れる */}
      <button
        onClick={() => onOpenBusiness?.()}
        title="事業設定（ロゴ・大目標・事業名・削除）"
        className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg hover:bg-white/10"
      >
        {current?.logoUrl ? (
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded bg-white p-0.5">
            <img src={current.logoUrl} alt="" className="h-full w-full object-contain" />
          </span>
        ) : (
          <span className="flex h-7 w-7 items-center justify-center text-lg font-extrabold leading-none text-white">S</span>
        )}
      </button>
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
              <div key={w.id} className="flex items-center rounded-lg hover:bg-zinc-50">
                <button
                  onClick={() => {
                    setCurrent(w.id)
                    setOpen(false)
                  }}
                  className="flex min-w-0 flex-1 items-center justify-between rounded-lg px-3 py-2 text-left text-sm"
                >
                  <span className="truncate text-zinc-700">{w.name}</span>
                  {current?.id === w.id && <Check className="ml-2 h-4 w-4 shrink-0 text-brand" />}
                </button>
                {w.role === 'owner' && workspaces.length > 1 && (
                  <button
                    onClick={() => remove(w)}
                    title="この事業を削除"
                    className="mr-1 shrink-0 rounded-md p-1.5 text-zinc-300 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}

            <div className="my-1 border-t border-zinc-100" />

            <button
              onClick={() => {
                setOpen(false)
                onOpenBusiness?.()
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-600 hover:bg-zinc-50"
            >
              <Settings className="h-4 w-4" />
              事業設定（大目標・名前・削除）
            </button>

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

      {/* 中央: 検索（min-w-0で必ず縮む＝右の更新ボタンを押し出さない） */}
      <div className="flex min-w-0 flex-1 justify-center px-3">
        <SearchBox />
      </div>

      {/* 右: 更新（スマホは引っ張り更新が効かないのでボタンで） */}
      <button
        onClick={() => window.location.reload()}
        title="更新（最新の状態に読み込み直す）"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
      >
        <RefreshCw className="h-4 w-4" />
      </button>
      </div>
    </header>
  )
}
