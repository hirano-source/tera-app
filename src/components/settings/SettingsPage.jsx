import { useState } from 'react'
import { Settings, User, Building2, CalendarDays, Plug, LogOut, Check } from 'lucide-react'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../utils/supabaseClient'
import CalendarLinkModal from '../calendar/CalendarLinkModal'

// 設定 画面 (/settings)。プロフィール・ワークスペース・連携・ログアウト。
export default function SettingsPage() {
  const { user, current, reload } = useWorkspace()
  const { signOut } = useAuth()
  const [name, setName] = useState(user.name || '')
  const [saved, setSaved] = useState(false)
  const [calendarOpen, setCalendarOpen] = useState(false)

  const saveName = async () => {
    if (!name.trim() || !user.id) return
    await supabase.from('users').update({ name: name.trim() }).eq('id', user.id)
    await reload()
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <div className="mx-auto max-w-[760px] px-10 py-8">
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

      {/* ワークスペース */}
      <Section icon={Building2} title="ワークスペース">
        <p className="text-sm text-zinc-700">{current?.name ?? '—'}</p>
        <p className="mt-1 text-xs text-zinc-400">
          メンバーの招待は「メンバー」画面から行えます。
        </p>
      </Section>

      {/* 連携 */}
      <Section icon={CalendarDays} title="カレンダー連携">
        <button
          onClick={() => setCalendarOpen(true)}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
        >
          iCal / ICS URL を登録
        </button>
      </Section>

      {/* MCP */}
      <Section icon={Plug} title="Claude連携（MCP）">
        <p className="text-sm text-zinc-600">
          ローカルのClaude Codeから「話すだけで仕事が終わる」を使えます。
        </p>
        <p className="mt-1 text-xs text-zinc-400">
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

      <CalendarLinkModal open={calendarOpen} onClose={() => setCalendarOpen(false)} />
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
