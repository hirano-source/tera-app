import { useState } from 'react'
import { X, Copy, Check, UserPlus, LogIn } from 'lucide-react'
import { supabase } from '../../utils/supabaseClient'
import { useWorkspace } from '../../hooks/useWorkspace'

// 招待モーダル：招待コードの発行（owner/admin）と、コードでの参加。
export default function InviteModal({ open, onClose }) {
  const { currentId, current, reload, setCurrent } = useWorkspace()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  if (!open) return null

  const issue = async () => {
    setBusy(true); setErr(''); setCode('')
    const { data, error } = await supabase.rpc('create_invite', {
      p_workspace_id: currentId,
    })
    if (error) setErr(error.message)
    else setCode(data)
    setBusy(false)
  }

  const copy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const join = async () => {
    setBusy(true); setErr(''); setMsg('')
    const { data, error } = await supabase.rpc('redeem_invite', {
      p_code: joinCode.trim(),
    })
    if (error) setErr(error.message)
    else {
      await reload()
      if (data) setCurrent(data)
      setMsg('参加しました。ワークスペースを切り替えました。')
      setJoinCode('')
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold">メンバーを招待</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* コード発行 */}
        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <UserPlus className="h-4 w-4" />「{current?.name}」への招待コードを発行
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            このコードを相手に渡すと、同じワークスペースに参加できます。
          </p>
          {code ? (
            <div className="mt-3 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-zinc-100 px-4 py-3 text-center text-lg font-bold tracking-widest">
                {code}
              </code>
              <button
                onClick={copy}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-3 text-sm hover:bg-zinc-50"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <button
              onClick={issue}
              disabled={busy}
              className="mt-3 w-full rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy ? '発行中…' : '招待コードを発行'}
            </button>
          )}
        </div>

        <hr className="my-5 border-zinc-200" />

        {/* コードで参加 */}
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <LogIn className="h-4 w-4" />
            招待コードで参加する
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="例: A1B2C3D4"
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2.5 text-sm uppercase tracking-widest outline-none focus:border-zinc-500"
            />
            <button
              onClick={join}
              disabled={busy || !joinCode.trim()}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              参加
            </button>
          </div>
        </div>

        {msg && <p className="mt-3 text-sm text-emerald-600">{msg}</p>}
        {err && <p className="mt-3 text-sm text-red-500">{err}</p>}
      </div>
    </div>
  )
}
