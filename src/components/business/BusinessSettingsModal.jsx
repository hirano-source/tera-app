import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Target, Trash2, ExternalLink, Plus, Image as ImageIcon } from 'lucide-react'
import { supabase } from '../../utils/supabaseClient'
import { useWorkspace } from '../../hooks/useWorkspace'
import { VISION_MAX, clamp } from '../../utils/limits'

// 事業設定（左上ロゴ／事業ドロップダウンから開く）。
// 事業の大目標（北極星）・事業名の変更・事業の削除を1か所に集約。
export default function BusinessSettingsModal({ open, onClose }) {
  const { current, currentId, workspaces, renameBusiness, setVisionGoal, setAssistantContext, deleteBusiness, uploadLogo, removeLogo, user } =
    useWorkspace()
  const navigate = useNavigate()
  const canEdit = ['owner', 'admin'].includes(current?.role)
  const isOwner = current?.role === 'owner'
  const [name, setName] = useState('')
  const [visions, setVisions] = useState([]) // [{id,title}] 大目標は複数OK
  const [newVision, setNewVision] = useState('')
  const [ctxText, setCtxText] = useState('')
  const [busy, setBusy] = useState(false)
  const logoRef = useRef(null)

  // この事業の大目標（is_vision=true）を全部読む。移行前データの保険として
  // 旧・主大目標(vision_goal_id)も拾い、重複は除く。
  const loadVisions = async () => {
    const { data } = await supabase
      .from('goals')
      .select('id,title')
      .eq('workspace_id', currentId)
      .eq('is_vision', true)
      .order('created_at', { ascending: true })
    let list = data ?? []
    if (current?.visionGoalId && !list.some((v) => v.id === current.visionGoalId)) {
      const { data: legacy } = await supabase
        .from('goals')
        .select('id,title')
        .eq('id', current.visionGoalId)
        .maybeSingle()
      if (legacy) list = [legacy, ...list]
    }
    setVisions(list)
  }

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
    setCtxText(current.assistantContext ?? '')
    loadVisions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // 大目標を1つ追加（複数OK）。最初の1つは「主大目標」(vision_goal_id)にも設定し、
  // ゴール追加時の既定の置き場・MCP連携の起点にする。
  const addVision = async () => {
    const t = clamp(newVision.trim(), VISION_MAX)
    if (!t) return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({ workspace_id: currentId, owner_id: user?.id ?? null, title: t, progress: 0, is_vision: true, parent_id: null })
        .select('id,title')
        .single()
      if (error) throw error
      if (visions.length === 0) await setVisionGoal(currentId, data.id)
      setNewVision('')
      await loadVisions()
    } catch (e) {
      alert('大目標の追加に失敗しました: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const renameVision = async (id, title) => {
    const t = clamp(title.trim(), VISION_MAX)
    if (!t) return
    await supabase.from('goals').update({ title: t }).eq('id', id)
  }

  // 大目標を削除。配下のゴール・成果物・チャットも cascade で消える（要確認）。
  // 削除したのが主大目標なら、残りの先頭を主大目標に繰り上げる（無ければ解除）。
  const deleteVision = async (v) => {
    if (
      !confirm(
        `大目標「${v.title}」を削除しますか？\nこの大目標の下のゴール・タスク・成果物・チャットもすべて削除され、元に戻せません。`,
      )
    )
      return
    setBusy(true)
    try {
      const { error } = await supabase.from('goals').delete().eq('id', v.id)
      if (error) throw error
      if (current?.visionGoalId === v.id) {
        const next = visions.find((x) => x.id !== v.id)
        await setVisionGoal(currentId, next?.id ?? null)
      }
      await loadVisions()
    } catch (e) {
      alert('削除に失敗しました: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const saveContext = async () => {
    setBusy(true)
    try {
      await setAssistantContext(currentId, ctxText.trim())
    } catch (e) {
      alert('保存に失敗しました: ' + (e?.message ?? e))
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

          {/* 大目標（複数OK・ここでのみ追加/変更/削除できる） */}
          <section>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-zinc-500">
              <Target className="h-3.5 w-3.5" /> 事業の大目標
            </label>

            {visions.length > 0 ? (
              <div className="space-y-2">
                {visions.map((v) => (
                  <div key={v.id} className="rounded-lg border border-brand/30 bg-brand/5 p-3">
                    {canEdit ? (
                      <input
                        defaultValue={v.title}
                        maxLength={VISION_MAX}
                        onBlur={(e) => renameVision(v.id, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="w-full rounded-md border border-zinc-300 bg-white px-2.5 py-1.5 text-sm font-medium text-zinc-800 outline-none focus:border-zinc-500"
                      />
                    ) : (
                      <p className="font-medium text-zinc-800">{v.title}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          navigate(`/goals/${v.id}`)
                          onClose()
                        }}
                        className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
                      >
                        <ExternalLink className="h-4 w-4" /> 開く
                      </button>
                      {canEdit && (
                        <button
                          onClick={() => deleteVision(v)}
                          disabled={busy}
                          className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" /> 削除
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">まだ大目標がありません。{canEdit ? '下の欄から追加してください。' : ''}</p>
            )}

            {canEdit && (
              <div className="mt-2 flex gap-2">
                <input
                  value={newVision}
                  onChange={(e) => setNewVision(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addVision()}
                  maxLength={VISION_MAX}
                  placeholder="例：3年で日本一のゴルフスクールになる"
                  className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
                <button
                  onClick={addVision}
                  disabled={busy || !newVision.trim()}
                  className="flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" /> 追加
                </button>
              </div>
            )}
            <p className="mt-1.5 text-xs text-zinc-400">
              この事業の大きな目標。複数立てられます。ふだんのゴールは各大目標の下に積み上げます（最大{VISION_MAX}字）。
            </p>
          </section>

          {/* この事業の文脈（魂）＝Claude連携時に渡る */}
          <section>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              この事業の文脈（Claudeに渡す）
            </label>
            {canEdit ? (
              <>
                <textarea
                  value={ctxText}
                  onChange={(e) => setCtxText(e.target.value)}
                  rows={5}
                  placeholder="この事業で大切にしている考え方・本質・お客さん像・方針など。Claudeが連携時に読み、これに沿って導きます。"
                  className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={saveContext}
                    disabled={busy || ctxText === (current.assistantContext ?? '')}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                  >
                    保存
                  </button>
                </div>
              </>
            ) : ctxText ? (
              <p className="whitespace-pre-wrap text-sm text-zinc-600">{ctxText}</p>
            ) : (
              <p className="text-sm text-zinc-400">未設定</p>
            )}
            <p className="mt-1.5 text-xs text-zinc-400">
              スマホ／PCのClaudeにSavoを繋ぐと、ここに書いた文脈を理解した状態で「次に何をすべきか」を提案します。
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
