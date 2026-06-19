import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../utils/supabaseClient'

// Claude（カスタムコネクター）の認可画面。
// 関数の /authorize から #/connect?... へ誘導され、ここでログイン＆「許可」する。
// 許可すると refresh_token を /authorize/complete に渡し、返ってきたURLでClaudeへ戻る。
const MCP_URL =
  import.meta.env.VITE_MCP_URL ??
  'https://rjxfleeyntqusuoqzclw.supabase.co/functions/v1/mcp'

// #/connect?a=b の形からクエリを取り出す（HashRouter下）
function paramsFromHash() {
  const q = window.location.hash.split('?')[1] ?? ''
  return Object.fromEntries(new URLSearchParams(q))
}

export default function MCPConnectPage() {
  const { session, signIn } = useAuth()
  const oauth = paramsFromHash()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // パラメータ不足＝不正な入口
  if (!oauth.client_id || !oauth.redirect_uri || !oauth.code_challenge) {
    return <Shell><p className="text-sm text-rose-300">接続パラメータが不足しています。</p></Shell>
  }

  const doLogin = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await signIn(email, password)
    setBusy(false)
    if (error) setError('メールアドレスかパスワードが違います')
  }

  // 「許可」：今のセッションの refresh_token を関数に渡し、Claudeへ戻る
  const approve = async () => {
    setBusy(true)
    setError('')
    try {
      const { data } = await supabase.auth.getSession()
      const refresh_token = data.session?.refresh_token
      if (!refresh_token) throw new Error('セッションが見つかりません。ログインし直してください。')
      const res = await fetch(`${MCP_URL}/authorize/complete`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: oauth.client_id,
          redirect_uri: oauth.redirect_uri,
          code_challenge: oauth.code_challenge,
          state: oauth.state,
          resource: oauth.resource,
          refresh_token,
        }),
      })
      const body = await res.json()
      if (!res.ok || !body.redirect) throw new Error(body.error_description || body.error || '認可に失敗しました')
      window.location.href = body.redirect // Claudeのコールバックへ
    } catch (e) {
      setBusy(false)
      setError(e.message)
    }
  }

  // 未ログイン → ログインフォーム
  if (!session) {
    return (
      <Shell>
        <p className="mb-5 text-sm text-zinc-400">Claude に接続するため、TERA にログインしてください。</p>
        {error && <Err>{error}</Err>}
        <form onSubmit={doLogin} className="space-y-3">
          <Field label="メールアドレス" type="email" value={email} onChange={setEmail} autoFocus />
          <Field label="パスワード" type="password" value={password} onChange={setPassword} />
          <Button disabled={busy}>{busy ? '確認中…' : 'ログイン'}</Button>
        </form>
      </Shell>
    )
  }

  // ログイン済み → 許可ボタン
  return (
    <Shell>
      <p className="mb-2 text-sm text-zinc-300">
        <span className="font-semibold text-white">{session.user.email}</span> として接続します。
      </p>
      <p className="mb-5 text-xs leading-relaxed text-zinc-500">
        許可すると、Claude があなたとして TERA のゴール・タスク・活動記録を読み書きできるようになります（あなたの権限の範囲）。
      </p>
      {error && <Err>{error}</Err>}
      <Button onClick={approve} disabled={busy}>{busy ? '接続中…' : 'Claude に接続を許可'}</Button>
    </Shell>
  )
}

// ── 表示パーツ（このページ専用の最小UI）──
function Shell({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="w-[340px] rounded-2xl bg-[#1a1b2e] p-8 shadow-2xl">
        <div className="mb-1 text-2xl font-extrabold tracking-widest text-brand">TERA</div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, type, value, onChange, autoFocus }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full rounded-lg border border-[#34344f] bg-[#11121f] px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-brand"
      />
    </label>
  )
}

function Button({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mt-2 w-full rounded-lg bg-brand py-3 text-sm font-bold text-white disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function Err({ children }) {
  return <div className="mb-3 rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-300">{children}</div>
}
