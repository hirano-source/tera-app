import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'

// チャット：ゴール＝スレッド。スレッド一覧（ゴール）とメッセージの取得/送信。
export function useChat(goalId) {
  const { currentId, user } = useWorkspace()
  const [threads, setThreads] = useState([])
  const [messages, setMessages] = useState([])
  const [authors, setAuthors] = useState({})
  const [loading, setLoading] = useState(true)

  // スレッド一覧（＝ゴール）＋メンバー名
  useEffect(() => {
    if (!currentId) return
    let active = true
    ;(async () => {
      const [{ data: goals }, { data: users }] = await Promise.all([
        supabase.from('goals').select('id,title').eq('workspace_id', currentId).order('created_at'),
        supabase.from('users').select('id,name'),
      ])
      if (!active) return
      setThreads(goals ?? [])
      setAuthors(Object.fromEntries((users ?? []).map((u) => [u.id, u.name])))
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [currentId])

  // 選択スレッドのメッセージ
  const loadMessages = useCallback(async () => {
    if (!goalId) {
      setMessages([])
      return
    }
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
  }, [goalId])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  const sendMessage = async (body) => {
    const text = body.trim()
    if (!text || !goalId || !currentId) return
    const { data } = await supabase
      .from('messages')
      .insert({
        workspace_id: currentId,
        goal_id: goalId,
        author_id: user?.id ?? null,
        body: text,
      })
      .select()
      .single()
    if (data) setMessages((m) => [...m, data])
  }

  return { threads, messages, authors, loading, sendMessage, meId: user?.id }
}
