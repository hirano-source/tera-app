import { useLocation } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import AppRouter from './routing/AppRouter'
import LoginPage from './components/auth/LoginPage'
import MCPConnectPage from './components/auth/MCPConnectPage'
import { useWorkspace } from './hooks/useWorkspace'
import { useAuth } from './hooks/useAuth'

// ───────────────────────────────────────────────────────────
// App.jsx = 司令塔（オーケストレーター）
// 認証ゲート → レイアウト → ルーターの組み立てに徹する。
// ロジックは hooks/、UIは components/、画面遷移は routing/ に委譲（掟）。
// ───────────────────────────────────────────────────────────
export default function App() {
  const { loading, session } = useAuth()
  const { user, points } = useWorkspace()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sidebar text-zinc-400">
        読み込み中…
      </div>
    )
  }

  // Claude コネクターの認可画面は認証ゲートの外（自前でログインを扱う）
  if (location.pathname.startsWith('/connect')) return <MCPConnectPage />

  if (!session) return <LoginPage />

  return (
    <AppLayout user={user} points={points}>
      <AppRouter />
    </AppLayout>
  )
}
