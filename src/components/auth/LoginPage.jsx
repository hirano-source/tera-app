import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'

// ログイン / サインアップ画面。Supabase Auth を使う。
export default function LoginPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    setInfo('')
    const { error } =
      mode === 'login'
        ? await signIn(email, password)
        : await signUp(email, password, name)
    if (error) setError(error.message)
    else if (mode === 'signup')
      setInfo('登録しました。そのままログインできない場合はメール確認が有効です。')
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-8 mt-2 flex flex-col items-center gap-4">
          <div className="text-4xl font-extrabold tracking-[0.2em] text-brand">Savo</div>
          <p className="text-sm text-zinc-500">
            {mode === 'login' ? 'ログイン' : '新規登録'}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名前"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="メールアドレス"
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワード"
            required
            className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-sm outline-none focus:border-zinc-500"
          />

          {error && <p className="text-sm text-red-500">{error}</p>}
          {info && <p className="text-sm text-emerald-600">{info}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? '処理中…' : mode === 'login' ? 'ログイン' : '登録する'}
          </button>
        </form>

        <button
          onClick={() => {
            setMode(mode === 'login' ? 'signup' : 'login')
            setError('')
            setInfo('')
          }}
          className="mt-4 w-full text-center text-sm text-zinc-500 hover:text-zinc-800"
        >
          {mode === 'login'
            ? 'アカウントがない方はこちら（新規登録）'
            : 'すでに登録済みの方はこちら（ログイン）'}
        </button>
      </div>
    </div>
  )
}
