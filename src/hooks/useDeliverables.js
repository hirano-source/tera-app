import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'

const BUCKET = 'deliverables'

// ゴールの成果物（ファイル）。Supabase Storage + deliverables テーブル。
// テーブル/バケット未作成の環境では available=false にして静かに無効化する
// （db/deliverables.sql を一度実行すれば有効化）。
export function useDeliverables(goalId) {
  const { currentId, user } = useWorkspace()
  const [items, setItems] = useState([])
  const [available, setAvailable] = useState(true)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!goalId || !currentId) return
    const { data, error } = await supabase
      .from('deliverables')
      .select('*')
      .eq('goal_id', goalId)
      .order('created_at', { ascending: false })
    if (error) {
      setAvailable(false)
      return
    }
    setAvailable(true)
    setItems(data ?? [])
  }, [goalId, currentId])

  useEffect(() => {
    load()
  }, [load])

  const upload = async (file) => {
    if (!file || !goalId || !currentId) return
    setBusy(true)
    try {
      const path = `${currentId}/${goalId}/${Date.now()}_${file.name}`
      const up = await supabase.storage.from(BUCKET).upload(path, file)
      if (up.error) throw up.error
      const { error } = await supabase.from('deliverables').insert({
        workspace_id: currentId,
        goal_id: goalId,
        name: file.name,
        storage_path: path,
        kind: file.type || 'file',
        uploaded_by: user?.id ?? null,
      })
      if (error) throw error
      await load()
    } catch (e) {
      alert('アップロードに失敗しました: ' + (e.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  // リンク成果物を追加（動画はYouTube/Drive等のURLを貼る。容量を食わない）
  const addLink = async (url, name) => {
    const u = (url || '').trim()
    if (!u || !goalId || !currentId) return
    const href = /^https?:\/\//i.test(u) ? u : `https://${u}`
    setBusy(true)
    try {
      const { error } = await supabase.from('deliverables').insert({
        workspace_id: currentId,
        goal_id: goalId,
        name: (name || '').trim() || href,
        url: href,
        kind: 'link',
        uploaded_by: user?.id ?? null,
      })
      if (error) throw error
      await load()
    } catch (e) {
      alert('リンクの追加に失敗しました: ' + (e.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  // 開く：リンクはそのURL、ファイルは署名付きURL
  const open = async (item) => {
    if (item.url) {
      window.open(item.url, '_blank')
      return
    }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.storage_path, 60)
    if (error) {
      alert('開けませんでした: ' + error.message)
      return
    }
    window.open(data.signedUrl, '_blank')
  }

  const remove = async (item) => {
    if (!confirm(`「${item.name}」を削除しますか？`)) return
    if (item.storage_path) await supabase.storage.from(BUCKET).remove([item.storage_path])
    await supabase.from('deliverables').delete().eq('id', item.id)
    await load()
  }

  return { items, available, busy, upload, addLink, open, remove }
}
