import { useState } from 'react'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomNav from './BottomNav'
import { useBadges } from '../../hooks/useBadges'
import { useAutoUpdate } from '../../hooks/useAutoUpdate'
import BusinessSettingsModal from '../business/BusinessSettingsModal'

// アプリ全体の枠（シェル）。サイドバー＋上部バー＋本文領域を組む。
// 本文（各画面）は children として受け取る。
// PC: 左サイドバー。スマホ: サイドバーを隠し、下部タブバー（BottomNav）を表示。
export default function AppLayout({ user, children }) {
  useAutoUpdate() // 新版デプロイ時に自動で読み込み直す（ホーム追加アプリ対策）
  const badges = useBadges()
  const [bizOpen, setBizOpen] = useState(false)
  const openBiz = () => setBizOpen(true)
  return (
    <div className="flex h-full w-full overflow-hidden bg-sidebar">
      <Sidebar user={user} badges={badges} onOpenBusiness={openBiz} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenBusiness={openBiz} />
        <main className="min-h-0 flex-1 overflow-y-auto bg-white md:rounded-tl-2xl">
          {children}
        </main>
        <BottomNav badges={badges} />
      </div>
      <BusinessSettingsModal open={bizOpen} onClose={() => setBizOpen(false)} />
    </div>
  )
}
