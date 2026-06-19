import Sidebar from './Sidebar'
import TopBar from './TopBar'

// アプリ全体の枠（シェル）。サイドバー＋上部バー＋本文領域を組む。
// 本文（各画面）は children として受け取る。
export default function AppLayout({ user, children }) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-sidebar">
      <Sidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto rounded-tl-2xl bg-white">
          {children}
        </main>
      </div>
    </div>
  )
}
