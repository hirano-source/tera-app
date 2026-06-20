import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Target, Trash2, Check, ExternalLink, Plus, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../utils/supabaseClient'
import { useWorkspace } from '../../hooks/useWorkspace'

// 事業設定（左上ロゴ／事業ドロップダウンから開く）。
// 事業の大目標（北極星）・事業名の変更・事業の削除を1か所に集約。
export default function BusinessSettingsModal({ open, onClose }) {
  const { current, currentId, workspaces, renameBusiness, setVisionGoal, deleteBusiness, uploadLogo, removeLogo, user } =
    useWorkspace()
  const navigate = useNavigate()
  const canEdit = ['owner', 'admin'].includes(current?.role)
  const isOwner = current?.role === 'owner'
  const [name, setName] = useState('')
  const [vision, setVision] = useState(null) // {id,title} | null
  const [newVision, setNewVision] = useState('')
  const [busy, setBusy] = useState(false)
  const logoRef = useRef(null)

  const onPickLogo = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      await uploadLogo(currentId, f)
    } catch (err) {
      alert('ロゴのアップロードに失敗しました: ' + (err?.message ?? err))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!open || !current) return
    setName(current.name ?? '')
    let active = true
    if (current.visionGoalId) {
      supabase
        .from('goals')
        .select('id,title')
        .eq('id', current.visionGoalId)
        .maybeSingle()
        .then(({ data }) => {
          if (active) setVision(data)
        })
    } else {
      setVision(null)
    }
    return () => {
      active = false
    }
  }, [open, current])

  if (!open || !current) return null

  const saveName = async () => {
    const v = name.trim()
    if (!v) return
    setBusy(true)
    try {
      await renameBusiness(currentId, v)
    } catch (e) {
      alert('変更に失敗しました: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const createVision = async () => {
    const t = newVision.trim()
    if (!t) return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({ workspace_id: currentId, owner_id: user?.id ?? null, title: t, progress: 0 })
        .select('id,title')
        .single()
      if (error) throw error
      await setVisionGoal(currentId, data.id)
      setVision(data)
      setNewVision('')
    } catch (e) {
      alert('大目標の設定に失敗しました: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const saveVisionTitle = async () => {
    const t = (vision?.title || '').trim()
    if (!t || !vision) return
    await supabase.from('goals').update({ title: t }).eq('id', vision.id)
  }

  const achieveVision = async () => {
    if (!vision) return
    if (!confirm(`大目標「${vision.title}」を達成済みにして、新しい大目標を設定できるようにします。よろしいですか？`)) return
    setBusy(true)
    try {
      await supabase.from('goals').update({ status: 'done' }).eq('id', vision.id)
      await setVisionGoal(currentId, null)
      setVision(null)
    } catch (e) {
      alert('失敗しました: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const removeBiz = async () => {
    if (workspaces.length <= 1) return
    if (
      !confirm(
        `事業「${current.name}」を削除しますか？\nこの事業のゴール・タスク・成果物・チャットもすべて削除され、元に戻せません。`,
      )
    )
      return
    try {
      await deleteBusiness(currentId)
      onClose()
    } catch (e) {
      alert('削除に失敗しました: ' + (e?.message ?? e))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h3 className="font-bold">事業設定</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          {/* 事業名 */}
          <section>
            <label className="mb-1 block text-xs font-medium text-zinc-500">事業名</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!canEdit}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-50"
              />
              {canEdit && (
                <button
                  onClick={saveName}
                  disabled={busy || !name.trim() || name.trim() === current.name}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                >
                  保存
                </button>
              )}
            </div>
          </section>

          {/* ロゴ */}
          <section>
            <label className="mb-1 block text-xs font-medium text-zinc-500">ロゴ</label>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50">
                {current.logoUrl ? (
                  <img src={current.logoUrl} alt="logo" className="h-full w-full object-contain" />
                ) : (
                  <ImageIcon className="h-6 w-6 text-zinc-300" />
                )}
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button
                    onClick={() => logoRef.current?.click()}
                    disabled={busy}
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 disabled:opacity-40"
                  >
                    {current.logoUrl ? 'ロゴを変更' : 'ロゴを設定'}
                  </button>
                  {current.logoUrl && (
                    <button
                      onClick={() => removeLogo(currentId)}
                      disabled={busy}
                      className="rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
                    >
                      削除
                    </button>
                  )}
                  <input ref={logoRef} type="file" accept="image/*" onChange={onPickLogo} className="hidden" />
                </div>
              )}
            </div>
            <p className="mt-1.5 text-xs text-zinc-400">左上やヘッダーに表示されます（PNG/SVG等の画像）。</p>
          </section>

          {/* 大目標 */}
          <section>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <Target className="h-3.5 w-3.5" /> 事業の大目標（北極星）
            </label>
            {vision ? (
              <div className="rounded-lg border border-brand/30 bg-brand/5 p-3">
                {canEdit ? (
                  <input
                    value={vision.title}
                    onChange={(e) => setVision((v) => ({ ...v, title: e.target.value }))}
                    onBlur={saveVisionTitle}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-800 outline-none focus:border-zinc-500"
                  />
                ) : (
                  <p className="font-medium text-zinc-800">{vision.title}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      navigate(`/goals/${vision.id}`)
                      onClose()
                    }}
                    className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
                  >
                    <ExternalLink className="h-4 w-4" /> 開く
                  </button>
                  {canEdit && (
                    <button
                      onClick={achieveVision}
                      disabled={busy}
                      className="flex items-center gap-1 rounded-lg border border-emerald-200 px-3 py-1.5 text-sm text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                    >
                      <Check className="h-4 w-4" /> 達成して新しく設定
                    </button>
                  )}
                </div>
              </div>
            ) : canEdit ? (
              <div className="flex gap-2">
                <input
                  value={newVision}
                  onChange={(e) => setNewVision(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && createVision()}
                  placeholder="例：3年で日本一のゴルフスクールになる"
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
                <button
                  onClick={createVision}
                  disabled={busy || !newVision.trim()}
                  className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" /> 設定
                </button>
              </div>
            ) : (
              <p className="text-sm text-zinc-400">未設定</p>
            )}
            <p className="mt-1.5 text-xs text-zinc-400">
              この事業の一番大きな目標。ふだんのゴールはこの下に積み上げます。「開く」で理想／現状／差まで書けます。
            </p>
          </section>

          {/* 削除 */}
          {isOwner && (
            <section className="border-t border-zinc-100 pt-4">
              {workspaces.length > 1 ? (
                <button
                  onClick={removeBiz}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" /> この事業を削除
                </button>
              ) : (
                <p className="text-xs text-zinc-400">※ 最後の1事業は削除できません（先に別の事業を作ってください）。</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
