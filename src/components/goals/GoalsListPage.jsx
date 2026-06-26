import { Fragment, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Compass, Play, Plus, ChevronRight, Settings } from 'lucide-react'
import { useGoals } from '../../hooks/useGoals'
import { useWorkspace } from '../../hooks/useWorkspace'
import { GOAL_MAX } from '../../utils/limits'

// ゴール一覧 画面 (/goals)。
// 大目標（is_vision）は複数立てられ、それぞれが頂点。ふだんのゴールは各大目標の下に積む。
// 大目標の追加・変更・削除は「事業設定」だけで行う（この画面では作らない）。
export default function GoalsListPage() {
  const { goals, createGoal } = useGoals()
  const { current } = useWorkspace()
  const navigate = useNavigate()
  const canEdit = ['owner', 'admin'].includes(current?.role)

  // 大目標＝is_vision。移行前データの保険として旧・主大目標(visionGoalId)も大目標扱いに。
  const isVision = (g) => g.is_vision || g.id === current?.visionGoalId
  const visions = useMemo(() => goals.filter(isVision), [goals, current?.visionGoalId])
  // 大目標にぶら下がっていない最上位ゴール（旧データ・付け替え漏れの受け皿）
  const orphans = useMemo(
    () => goals.filter((g) => !isVision(g) && g.parent_id === null),
    [goals, current?.visionGoalId],
  )

  const [addingFor, setAddingFor] = useState(null) // 入力中の大目標id（または 'orphan'）
  const [title, setTitle] = useState('')

  // 親→子の索引（階層描画用）
  const byParent = useMemo(() => {
    const m = {}
    goals.forEach((g) => {
      ;(m[g.parent_id] ??= []).push(g)
    })
    return m
  }, [goals])

  const submit = async (parentId) => {
    const v = title.trim()
    if (!v) return
    await createGoal(v, parentId)
    setTitle('')
    setAddingFor(null)
  }

  // 1ゴールの行＋その配下を再帰描画
  const renderNode = (g, depth) => (
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
      {(byParent[g.id] ?? []).map((c) => renderNode(c, depth + 1))}
    </Fragment>
  )

  // 指定の親IDの配下を階層で描く（大目標自身は描かない＝呼び出し側がカードで描く）
  const renderTree = (parentId, depth) => (byParent[parentId] ?? []).map((g) => renderNode(g, depth))

  // 大目標カード＋その配下のゴール群（＋ゴール追加）
  const renderVisionBlock = (v) => {
    const children = byParent[v.id] ?? []
    return (
      <section key={v.id} className="mb-8">
        <button
          onClick={() => navigate(`/goals/${v.id}`)}
          className="group block w-full overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 text-left shadow-sm transition hover:shadow"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/20 text-amber-600">
              <Compass className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">事業の大目標</div>
              <div className="mt-0.5 truncate text-xl font-bold text-zinc-900">{v.title}</div>
            </div>
            <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-amber-300 group-hover:text-amber-500" />
          </div>
        </button>

        {canEdit && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => {
                setAddingFor(v.id)
                setTitle('')
              }}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
            >
              <Plus className="h-4 w-4" /> この大目標にゴールを追加
            </button>
          </div>
        )}

        {addingFor === v.id && (
          <div className="mt-2 flex items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <Plus className="h-4 w-4" />
            </span>
            <input
              autoFocus
              value={title}
              maxLength={GOAL_MAX}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit(v.id)
                if (e.key === 'Escape') {
                  setAddingFor(null)
                  setTitle('')
                }
              }}
              placeholder="この大目標の下に積むゴールを入力して Enter"
              className="flex-1 bg-transparent text-zinc-700 outline-none placeholder:text-zinc-400"
            />
            <button
              onClick={() => submit(v.id)}
              disabled={!title.trim()}
              className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
            >
              追加
            </button>
          </div>
        )}

        <ul className="mt-1 space-y-0.5">
          {renderTree(v.id, 0)}
          {children.length === 0 && addingFor !== v.id && (
            <li className="py-6 text-center text-sm text-zinc-400">
              まだゴールがありません。「この大目標にゴールを追加」で積みましょう。
            </li>
          )}
        </ul>
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 sm:px-10 sm:py-8">
      {visions.length > 0 ? (
        visions.map(renderVisionBlock)
      ) : (
        <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 p-5">
          <div className="flex items-center gap-2 text-amber-700">
            <Compass className="h-5 w-5" />
            <span className="font-semibold">まだ大目標がありません</span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            大目標は「事業設定」から追加できます（複数立てられます）。ふだんのゴールは各大目標の下に積み上がります。
          </p>
          {canEdit && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500">
              <Settings className="h-4 w-4" /> 左上のロゴ／事業名 →「事業設定」→「事業の大目標」
            </p>
          )}
        </div>
      )}

      {/* 大目標に紐づいていないゴール（旧データの受け皿）。消えないように必ず表示する。 */}
      {orphans.length > 0 && (
        <section className="mt-4 border-t border-zinc-200 pt-6">
          <h2 className="mb-2 text-sm font-semibold text-zinc-500">大目標に未分類のゴール</h2>
          <ul className="space-y-0.5">{orphans.map((g) => renderNode(g, 0))}</ul>
        </section>
      )}
    </div>
  )
}
