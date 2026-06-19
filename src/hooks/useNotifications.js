import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'

// 通知：自分宛て（notifications.user_id = 自分）を新しい順で取得。既読化もできる。
// RLSでテナント分離済み。
export function useNotifications() {
  const { currentId, user } = useWorkspace()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentId || !user?.id) {
      setLoading(false)
      return
    }
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('workspace_id', currentId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setNotifications(data ?? [])
    setLoading(false)
  }, [currentId, user?.id])

  useEffect(() => {
    load()
  }, [load])

  const markRead = async (id) => {
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  const markAllRead = async () => {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id)
    if (ids.length === 0) return
    setNotifications((ns) => ns.map((n) => ({ ...n, read: true })))
    await supabase.from('notifications').update({ read: true }).in('id', ids)
  }

  const unreadCount = notifications.filter((n) => !n.read).length
  return { notifications, loading, markRead, markAllRead, unreadCount, reload: load }
}
