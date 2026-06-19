import {
  CheckSquare,
  Target,
  MessageCircle,
  Bell,
  Users,
  Settings,
} from 'lucide-react'

// 左サイドバーのナビ定義。ラベル・パス・アイコン・バッジを一元管理する。
// badgeKey: useBadges() の返すキーに対応（実データの件数を表示）。未指定はバッジ無し。
export const NAV_ITEMS = [
  { key: 'todo', label: '実行', path: '/todo', icon: CheckSquare, badgeKey: 'todo' },
  { key: 'goals', label: 'ゴール', path: '/goals', icon: Target },
  { key: 'chat', label: 'チャット', path: '/chat', icon: MessageCircle },
  { key: 'notifications', label: '通知', path: '/notifications', icon: Bell, badgeKey: 'notifications' },
  { key: 'members', label: 'メンバー', path: '/members', icon: Users },
  { key: 'settings', label: '設定', path: '/settings', icon: Settings },
]
