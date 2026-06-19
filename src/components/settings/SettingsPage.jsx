import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, User, Building2, Plug, LogOut, Check, ChevronRight } from 'lucide-react'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../utils/supabaseClient'

// 設定 画面 (/settings)。プロフィール・ワークスペース・連携・ログアウト。
export default function SettingsPage() {
  const { user, current, reload } = useWorkspace()
  const { signOut } = useAuth()
  const [name, setName] = useState(user.name || '')
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  // ホスト版MCPの公開URL（Claudeのカスタムコネクターに貼る）。env から導出。
  const mcpUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp`

  const saveName = async () => {
    if (!name.trim() || !user.id) return
    await supabase.from('users').update({ name: name.trim() }).eq('id', user.id)
    await reload()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const copyMcpUrl = async () => {
    await navigator.clipboard.writeText(mcpUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-10 sm:py-8">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <Settings className="h-6 w-6" />
        設定
      </h1>
      <hr className="my-5 border-zinc-200" />

      {/* プロフィール */}
      <Section icon={User} title="プロフィール">
        <label className="text-sm text-zinc-500">表示名</label>
        <div className="mt-1 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
          <button
            onClick={saveName}
            className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {saved ? <Check className="h-4 w-4" /> : '保存'}
          </button>
        </div>
      </Section>

      {/* 事業 */}
      <Section icon={Building2} title="事業">
        <p className="text-sm text-zinc-700">{current?.name ?? '—'}</p>
        <p className="mt-1 text-xs text-zinc-400">
          事業の切替・追加は上部バーから行えます。
        </p>
        <Link
          to="/members"
          className="mt-3 inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
        >
          メンバー・権限を管理
          <ChevronRight className="h-4 w-4" />
        </Link>
      </Section>

      {/* MCP */}
      <Section icon={Plug} title="Claude連携（MCP）">
        <p className="text-sm text-zinc-600">
          Claudeから「話すだけで仕事が終わる」を使えます。
        </p>

        {/* ホスト版（カスタムコネクター） */}
        <p className="mt-4 text-sm font-semibold text-zinc-700">
          Claudeデスクトップ / web
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Claudeのカスタムコネクターに下記URLを貼り、ログイン＆「許可」するだけ。
        </p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
            {mcpUrl}
          </code>
          <button
            onClick={copyMcpUrl}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50"
          >
            {copied ? <Check className="h-4 w-4 text-brand" /> : 'コピー'}
          </button>
        </div>

        {/* ローカル版（Claude Code） */}
        <p className="mt-4 text-sm font-semibold text-zinc-700">Claude Code（ローカル）</p>
        <p className="mt-1 text-xs text-zinc-500">
          プロジェクトの <code className="rounded bg-zinc-100 px-1">.env</code> にログインを設定し、Claude Codeを再起動 → 「おはよう、仕事しよう」。
        </p>
      </Section>

      {/* ログアウト */}
      <div className="mt-8">
        <button
          onClick={() => confirm('ログアウトしますか？') && signOut()}
          className="flex items-center gap-1.5 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </button>
      </div>
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="mb-6 rounded-2xl border border-zinc-200 p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        <Icon className="h-5 w-5 text-zinc-500" />
        {title}
      </h2>
      {children}
    </section>
  )
}
