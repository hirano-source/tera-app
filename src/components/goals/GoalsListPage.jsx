import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, Play, Plus, ChevronRight } from 'lucide-react'
import { supabase } from '../../utils/supabaseClient'
import { useGoals } from '../../hooks/useGoals'
import { useWorkspace } from '../../hooks/useWorkspace'

// ゴール一覧 画面 (/goals)。
// 設計A：事業の大目標（北極星）を頂点カードとして最上部に置き、
// ふだんのゴールはすべてその下に積み上がる階層として描く。
export default function GoalsListPage() {
  const { goals, createGoal } = useGoals()
  const { current, currentId, setVisionGoal, user } = useWorkspace()
  const navigate = useNavigate()
  const canEdit = ['owner', 'admin'].includes(current?.role)

  const visionId = current?.visionGoalId ?? null
  const visionGoal = goals.find((g) => g.id === visionId) ?? null

  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [newVision, setNewVision] = useState('')
  const [busy, setBusy] = useState(false)

  // 親→子の索引（階層描画用）
  const byParent = useMemo(() => {
    const m = {}
    goals.forEach((g) => {
      ;(m[g.parent_id] ??= []).push(g)
    })
    return m
  }, [goals])

  const submit = async () => {
    const v = title.trim()
    if (!v) return
    await createGoal(v) // 親未指定 → 大目標の下に入る（useGoals 側で自動）
    setTitle('')
    setAdding(false)
  }

  // 大目標を新規に決める（ゴールを作って vision に設定）
  const createVision = async () => {
    const t = newVision.trim()
    if (!t || !currentId) return
    setBusy(true)
    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({ workspace_id: currentId, owner_id: user?.id ?? null, title: t, progress: 0 })
        .select('id')
        .single()
      if (error) throw error
      await setVisionGoal(currentId, data.id)
      setNewVision('')
    } catch (e) {
      alert('大目標の設定に失敗しました: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  // 大目標の配下（または大目標未設定なら最上位）を階層で描く
  const renderTree = (parentId, depth) =>
    (byParent[parentId] ?? []).map((g) => (
      <Fragment key={g.id}>
        <li>
          <button
            onClick={() => navigate(`/goals/${g.id}`)}
            className="flex w-full items-center gap-3 rounded-lg py-2.5 pr-2 text-left hover:bg-zinc-50"
            style={{ paddingLeft: `${depth * 22 + 8}px` }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
              <Play className="h-4 w-4 translate-x-0.5 fill-brand" />
            </span>
            <span className="flex-1 truncate text-zinc-700">{g.title}</span>
            {g.progress > 0 && <span className="shrink-0 text-xs text-zinc-400">{g.progress}%</span>}
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-300" />
          </button>
        </li>
        {renderTree(g.id, depth + 1)}
      </Fragment>
    ))

  const ladder = visionGoal ? renderTree(visionGoal.id, 0) : renderTree(null, 0)

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-10 sm:py-8">
      {/* 頂点＝事業の大目標（北極星）。ここが旧「ゴール」見出しの置き換え。 */}
      {visionGoal ? (
        <button
          onClick={() => navigate(`/goals/${visionGoal.id}`)}
          className="group block w-full overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 text-left shadow-sm transition hover:shadow"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600">
              <Compass className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">
                事業の大目標
              </div>
              <div className="mt-0.5 truncate text-lg font-bold text-zinc-800">{visionGoal.title}</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-amber-100">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all"
                  style={{ width: `${visionGoal.progress ?? 0}%` }}
                />
              </div>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-amber-300 group-hover:text-amber-500" />
          </div>
        </button>
      ) : canEdit ? (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-5">
          <div className="flex items-center gap-2 text-amber-700">
            <Compass className="h-5 w-5" />
            <span className="font-semibold">事業の大目標を決める</span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            この事業の一番大きな目標。これを頂点に、ふだんのゴールはすべてこの下に積み上がります。
          </p>
          <div className="mt-3 flex gap-2">
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
              className="flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" /> 設定
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm text-zinc-400">
          事業の大目標はまだ設定されていません。
        </div>
      )}

      {/* 大目標の下のゴール */}
      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-500">
          {visionGoal ? 'この大目標の下のゴール' : 'ゴール'}
        </h2>
        <button
          onClick={() => setAdding((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          ゴールを追加
        </button>
      </div>

      <hr className="my-3 border-zinc-200" />

      {adding && (
        <div className="mb-3 flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
            <Plus className="h-4 w-4" />
          </span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
              if (e.key === 'Escape') {
                setAdding(false)
                setTitle('')
              }
            }}
            placeholder={visionGoal ? '大目標の下に積むゴールを入力して Enter' : '達成したいゴールを入力して Enter'}
            className="flex-1 bg-transparent text-zinc-700 outline-none placeholder:text-zinc-400"
          />
          <button
            onClick={submit}
            disabled={!title.trim()}
            className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            追加
          </button>
        </div>
      )}

      <ul className="space-y-0.5">
        {ladder}
        {ladder.length === 0 && !adding && (
          <li className="py-12 text-center text-sm text-zinc-400">
            {visionGoal
              ? 'まだゴールがありません。「ゴールを追加」で大目標の下に積みましょう。'
              : 'まだゴールがありません。「ゴールを追加」から作成できます。'}
          </li>
        )}
      </ul>
    </div>
  )
}
