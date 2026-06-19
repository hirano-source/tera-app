import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'

// サイドバー／下部タブのバッジ数（実データ）。
// 実行 = 未完了の今日のToDo件数 / 通知 = 未読通知件数。
// AppLayout で一度だけ呼び、Sidebar・BottomNav に配る（二重取得を避ける）。
export function useBadges() {
  const { currentId, user } = useWorkspace()
  const [badges, setBadges] = useState({ todo: 0, notifications: 0 })

  useEffect(() => {
    if (!currentId || !user?.id) {
      setBadges({ todo: 0, notifications: 0 })
      return
    }
    let active = true
    ;(async () => {
      const [{ count: todo }, { count: notif }] = await Promise.all([
        supabase
          .from('tasks')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentId)
          .eq('is_today', true)
          .neq('status', 'done'),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', currentId)
          .eq('user_id', user.id)
          .eq('read', false),
      ])
      if (active) setBadges({ todo: todo ?? 0, notifications: notif ?? 0 })
    })()
    return () => {
      active = false
    }
  }, [currentId, user?.id])

  return badges
}
