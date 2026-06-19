import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'

// 対象（ゴール/タスク）へのコメント。経緯・詰まりを残す。
// comments テーブル（target_type/target_id）を使う。RLSでテナント分離済み。
export function useComments(targetType, targetId) {
  const { currentId, user } = useWorkspace()
  const [comments, setComments] = useState([])
  const [authors, setAuthors] = useState({})

  const load = useCallback(async () => {
    if (!targetId || !currentId) return
    const [{ data: rows }, { data: users }] = await Promise.all([
      supabase
        .from('comments')
        .select('*')
        .eq('workspace_id', currentId)
        .eq('target_type', targetType)
        .eq('target_id', targetId)
        .order('created_at', { ascending: true }),
      supabase.from('users').select('id,name'),
    ])
    setComments(rows ?? [])
    setAuthors(Object.fromEntries((users ?? []).map((u) => [u.id, u.name])))
  }, [targetType, targetId, currentId])

  useEffect(() => {
    load()
  }, [load])

  const addComment = async (body) => {
    const text = body.trim()
    if (!text || !targetId || !currentId) return
    const { data } = await supabase
      .from('comments')
      .insert({
        workspace_id: currentId,
        target_type: targetType,
        target_id: targetId,
        author_id: user?.id ?? null,
        body: text,
      })
      .select()
      .single()
    if (data) setComments((c) => [...c, data])
  }

  // 解決済み⇔未解決のトグル（楽観的更新）
  const toggleResolved = async (comment) => {
    const next = !comment.resolved
    setComments((c) => c.map((x) => (x.id === comment.id ? { ...x, resolved: next } : x)))
    await supabase.from('comments').update({ resolved: next }).eq('id', comment.id)
  }

  return { comments, authors, addComment, toggleResolved, count: comments.length, meId: user?.id }
}
