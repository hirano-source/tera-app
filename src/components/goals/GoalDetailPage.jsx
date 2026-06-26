import { useEffect, useRef, useState, useMemo, useLayoutEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Search,
  ArrowUpDown,
  Upload,
  MessageSquare,
  Download,
  Trash2,
  FileText,
  Check,
  Play,
  Link2,
  ExternalLink,
  CornerUpRight,
} from 'lucide-react'
import { useGoal } from '../../hooks/useGoals'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useDeliverables } from '../../hooks/useDeliverables'
import { useGoalTasks } from '../../hooks/useGoalTasks'
import { supabase } from '../../utils/supabaseClient'
import { cn } from '../../utils/cn'
import { GOAL_MAX } from '../../utils/limits'
import { derivePhase } from '../../utils/goalView'
import MovePickerModal from '../common/MovePickerModal'
import VisionDashboard from './VisionDashboard'
import CommentThread from '../comments/CommentThread'
import TaskDetailModal from '../tasks/TaskDetailModal'
import TaskMeta from '../tasks/TaskMeta'

// ゴール詳細 画面 (/goals/:id)。PC=2ペイン（左:内容／右:常駐チャット）。
// 左: パンくず＋タイトル＋ゴール情報＋タスク＋成果物。右: コメント/会話の蓄積。
export default function GoalDetailPage() {
  const { goalId } = useParams()
  const navigate = useNavigate()
  const { goal, loading, saveGoal, deleteGoal, reload: reloadGoal } = useGoal(goalId)
  const { current, currentId, user } = useWorkspace()
  const canEdit = ['owner', 'admin'].includes(current?.role)
  // 大目標（is_vision）かどうか。大目標の名前は事業設定からのみ変更できる。
  const isVisionGoal = !!goal && (goal.is_vision || goal.id === current?.visionGoalId)
  const { items, available, busy, upload, addLink, open: openItem, remove } = useDeliverables(goalId)
  const { tasks, addTask, toggleTask, deleteTask, reload: reloadTasks } = useGoalTasks(goalId)

  const fileRef = useRef(null)
  const [q, setQ] = useState('')
  const [asc, setAsc] = useState(true)
  const [dragOver, setDragOver] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [openTaskId, setOpenTaskId] = useState(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkName, setLinkName] = useState('')

  // ゴール情報（理想/現状/差/完了基準/期日/担当）の編集フォーム
  const [info, setInfo] = useState({ title: '', ideal_state: '', current: '', gap: '', criteria: '', due_date: '', owner_id: '' })
  const [members, setMembers] = useState([])
  const [savingInfo, setSavingInfo] = useState(false)
  const [crumbs, setCrumbs] = useState([])
  const [showMove, setShowMove] = useState(false)
  const [crumbBump, setCrumbBump] = useState(0) // 移動後にパンくずを引き直す
  const [activeTab, setActiveTab] = useState('content') // content | chat | tasks
  const [openFields, setOpenFields] = useState({}) // 中身4項目の開閉
  const toggleField = (k) => setOpenFields((p) => ({ ...p, [k]: !p[k] }))

  useEffect(() => {
    if (!goal) return
    setInfo({
      title: goal.title ?? '',
      ideal_state: goal.ideal_state ?? '',
      current: goal.current ?? '',
      gap: goal.gap ?? '',
      criteria: goal.criteria ?? '',
      due_date: goal.due_date ?? '',
      owner_id: goal.owner_id ?? '',
    })
  }, [goal])

  // メンバー一覧＋パンくず（親ゴールの連なり）用に、事業のゴールとメンバーを取得
  useEffect(() => {
    if (!currentId) return
    let active = true
    ;(async () => {
      const [{ data: mem }, { data: goals }] = await Promise.all([
        supabase.from('memberships').select('user_id').eq('workspace_id', currentId),
        supabase.from('goals').select('id,title,parent_id').eq('workspace_id', currentId),
      ])
      const ids = (mem ?? []).map((m) => m.user_id)
      if (ids.length) {
        const { data: us } = await supabase.from('users').select('id,name').in('id', ids)
        if (active) setMembers(us ?? [])
      }
      // パンくず：goalId から parent_id を辿ってルートまで
      if (active) {
        const map = Object.fromEntries((goals ?? []).map((g) => [g.id, g]))
        const chain = []
        let cur = map[goalId]
        let guard = 0
        while (cur && guard++ < 20) {
          chain.unshift(cur)
          cur = cur.parent_id ? map[cur.parent_id] : null
        }
        setCrumbs(chain)
      }
    })()
    return () => {
      active = false
    }
  }, [currentId, goalId, crumbBump])

  const infoDirty =
    !!goal &&
    ((info.title ?? '') !== (goal.title ?? '') ||
      (info.ideal_state ?? '') !== (goal.ideal_state ?? '') ||
      (info.current ?? '') !== (goal.current ?? '') ||
      (info.gap ?? '') !== (goal.gap ?? '') ||
      (info.criteria ?? '') !== (goal.criteria ?? '') ||
      (info.due_date ?? '') !== (goal.due_date ?? '') ||
      (info.owner_id ?? '') !== (goal.owner_id ?? ''))

  const saveInfo = async () => {
    setSavingInfo(true)
    try {
      await saveGoal({
        title: info.title.trim() || goal.title,
        ideal_state: info.ideal_state || '',
        current: info.current || '',
        gap: info.gap || '',
        criteria: info.criteria || '',
        due_date: info.due_date || null,
        owner_id: info.owner_id || null,
      })
    } catch (e) {
      alert('保存に失敗しました: ' + (e?.message ?? e))
    } finally {
      setSavingInfo(false)
    }
  }

  const removeGoal = async () => {
    if (
      !confirm(
        `ゴール「${goal?.title}」を削除しますか？\n配下の子ゴール・成果物・チャットも一緒に削除されます（タスクは残り、ゴール紐づけが外れます）。元に戻せません。`,
      )
    )
      return
    try {
      await deleteGoal()
      navigate('/goals')
    } catch (e) {
      alert('ゴールの削除に失敗しました: ' + (e?.message ?? e))
    }
  }

  const shown = useMemo(() => {
    const f = items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase()))
    return [...f].sort((a, b) => (asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)))
  }, [items, q, asc])

  const doneCount = tasks.filter((t) => t.status === 'done').length
  const TABS = [
    { v: 'content', label: '中身' },
    { v: 'chat', label: 'チャット' },
    { v: 'tasks', label: tasks.length ? `タスク ${doneCount}/${tasks.length}` : 'タスク' },
  ]
  // 状態順（詰まり→進行中→未着手→完了）に並べ替えて表示する
  const sortedTasks = [...tasks].sort((a, b) => (TASK_ORDER[a.status] ?? 2) - (TASK_ORDER[b.status] ?? 2))
  // レーン：手動 phase を優先、無ければ自動判定
  const currentPhase = goal?.phase || (goal ? derivePhase(goal, tasks) : 'now')
  const setPhase = async (p) => {
    try {
      await saveGoal({ phase: p })
    } catch (e) {
      alert('保存に失敗しました: ' + (e?.message ?? e))
    }
  }

  if (loading || !goal) {
    return <div className="flex h-full items-center justify-center text-zinc-400">読み込み中…</div>
  }

  // 大目標を開いたときは「把握する画面」＝ダッシュボードに切り替える。
  if (isVisionGoal) {
    return (
      <div className="h-full overflow-y-auto">
        <VisionDashboard goalId={goalId} />
      </div>
    )
  }

  const onPick = (e) => {
    const f = e.target.files?.[0]
    if (f) upload(f)
    e.target.value = ''
  }
  const onDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (!available) return
    const f = e.dataTransfer.files?.[0]
    if (f) upload(f)
  }
  const submitTask = async () => {
    const v = newTask.trim()
    if (!v) return
    await addTask(v)
    setNewTask('')
  }
  const submitLink = async () => {
    const u = linkUrl.trim()
    if (!u) return
    await addLink(u, linkName)
    setLinkUrl('')
    setLinkName('')
    setLinkOpen(false)
  }

  return (
    <div className="flex h-full flex-col">
      {/* 内容（スクロール） */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[920px] px-4 py-5 sm:px-8">
          {/* パンくず */}
          {crumbs.length > 1 && (
            <nav className="mb-3 flex flex-wrap items-center gap-1 text-xs text-zinc-400">
              {crumbs.map((c, i) => (
                <span key={c.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" />}
                  {c.id === goalId ? (
                    <span className="text-zinc-600">{c.title}</span>
                  ) : (
                    <button onClick={() => navigate(`/goals/${c.id}`)} className="truncate hover:text-zinc-700 hover:underline">
                      {c.title}
                    </button>
                  )}
                </span>
              ))}
            </nav>
          )}

          {/* タイトル（編集可・1行＝高さを節約） */}
          {canEdit ? (
            <input
              value={info.title}
              maxLength={GOAL_MAX}
              onChange={(e) => setInfo((p) => ({ ...p, title: e.target.value }))}
              className="w-full rounded-lg border border-transparent px-1.5 py-1 text-2xl font-bold tracking-wide outline-none hover:border-zinc-200 focus:border-zinc-300"
            />
          ) : (
            <h1 className="px-1.5 text-2xl font-bold tracking-wide">{goal.title}</h1>
          )}

          {/* レーン（今ここ / 次 / あとで）。未設定は自動判定の値を初期表示。 */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-zinc-500">レーン</span>
            <div className="flex gap-1">
              {PHASE_OPTS.map((o) => {
                const on = currentPhase === o.v
                return (
                  <button
                    key={o.v}
                    onClick={() => canEdit && setPhase(o.v)}
                    disabled={!canEdit}
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium',
                      on ? 'border-terracotta bg-terracotta/10 text-terracotta' : 'border-zinc-300 text-zinc-500 hover:bg-zinc-50',
                      !canEdit && 'cursor-default',
                    )}
                  >
                    <span className={cn('h-2 w-2 rounded-full', o.dot)} /> {o.label}
                  </button>
                )
              })}
            </div>
            {!goal.phase && <span className="text-[11px] text-zinc-400">（自動判定）</span>}
          </div>

          {/* タブ：中身 / チャット / タスク（チャットは本文に出さずタブ内だけ） */}
          <div className="mt-4 flex gap-1 border-b border-zinc-200">
            {TABS.map((t) => (
              <button
                key={t.v}
                onClick={() => setActiveTab(t.v)}
                className={cn(
                  'relative px-4 py-2 text-sm font-medium',
                  activeTab === t.v ? 'text-zinc-900' : 'text-zinc-400 hover:text-zinc-600',
                )}
              >
                {t.label}
                {activeTab === t.v && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-zinc-900" />}
              </button>
            ))}
          </div>

          {/* === 中身タブ：期日/担当（1行）＋ 4項目アコーディオン === */}
          {activeTab === 'content' && (
            <section className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-sm">
                <label className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">期日</span>
                  {canEdit ? (
                    <input type="date" value={info.due_date || ''} onChange={(e) => setInfo((p) => ({ ...p, due_date: e.target.value }))} className="rounded-lg border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500" />
                  ) : (
                    <span className="text-zinc-700">{goal.due_date || '—'}</span>
                  )}
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">担当</span>
                  {canEdit ? (
                    <select value={info.owner_id || ''} onChange={(e) => setInfo((p) => ({ ...p, owner_id: e.target.value }))} className="rounded-lg border border-zinc-300 px-2 py-1 text-sm outline-none focus:border-zinc-500">
                      <option value="">未割当</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-zinc-700">{members.find((m) => m.id === goal.owner_id)?.name || '—'}</span>
                  )}
                </label>
              </div>

              <CollapsibleField label="◎ 理想の状態" value={info.ideal_state} open={!!openFields.ideal} onToggle={() => toggleField('ideal')}>
                {canEdit ? (
                  <AutoTextarea value={info.ideal_state} onChange={(e) => setInfo((p) => ({ ...p, ideal_state: e.target.value }))} placeholder="達成したらどうなっているか" className={taCls} />
                ) : (
                  <ReadVal v={goal.ideal_state} />
                )}
              </CollapsibleField>
              <CollapsibleField label="● 現状" value={info.current} open={!!openFields.current} onToggle={() => toggleField('current')}>
                {canEdit ? (
                  <AutoTextarea value={info.current} onChange={(e) => setInfo((p) => ({ ...p, current: e.target.value }))} placeholder="今どういう状態か" className={taCls} />
                ) : (
                  <ReadVal v={goal.current} />
                )}
              </CollapsibleField>
              <CollapsibleField label="その差（埋めるところ）" accent value={info.gap} open={!!openFields.gap} onToggle={() => toggleField('gap')}>
                {canEdit ? (
                  <AutoTextarea value={info.gap} onChange={(e) => setInfo((p) => ({ ...p, gap: e.target.value }))} placeholder="理想と現状のギャップ＝ここを埋める" className={taCls} />
                ) : (
                  <ReadVal v={goal.gap} />
                )}
              </CollapsibleField>
              <CollapsibleField label="✓ 完了の基準" value={info.criteria} open={!!openFields.criteria} onToggle={() => toggleField('criteria')}>
                {canEdit ? (
                  <AutoTextarea value={info.criteria} onChange={(e) => setInfo((p) => ({ ...p, criteria: e.target.value }))} placeholder="何ができたら完了か" className={taCls} />
                ) : (
                  <ReadVal v={goal.criteria} />
                )}
              </CollapsibleField>
            </section>
          )}

          {/* === タスクタブ：タスク＋成果物 === */}
          {activeTab === 'tasks' && (
          <>
          {/* タスク */}
          <section className="mt-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              タスク
              {tasks.length > 0 && (
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-500">
                  {doneCount}/{tasks.length}
                </span>
              )}
            </h2>
            <ul className="mt-3 space-y-1">
              {sortedTasks.map((t) => (
                <li
                  key={t.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-zinc-50',
                    t.status === 'blocked' && 'border border-lantern/30 bg-lantern/5',
                  )}
                >
                  <button
                    onClick={() => toggleTask(t)}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                      t.status === 'done' ? 'bg-emerald-500 text-white' : t.status === 'blocked' ? 'bg-lantern text-white' : 'bg-brand text-white',
                    )}
                  >
                    {t.status === 'done' ? <Check className="h-3 w-3" strokeWidth={3} /> : <Play className="h-2.5 w-2.5 translate-x-0.5 fill-white" />}
                  </button>
                  <button
                    onClick={() => setOpenTaskId(t.id)}
                    className={cn('min-w-0 flex-1 text-left text-sm', t.status === 'done' ? 'text-zinc-400 line-through' : 'text-zinc-700')}
                  >
                    <span className="block truncate">{t.title}</span>
                    {t.status === 'blocked' && (t.blocker_type || t.blocker_owner) && (
                      <span className="mt-0.5 block truncate text-[11px] font-medium text-lantern">
                        詰まり: {[BLOCKER_JP[t.blocker_type], t.blocker_owner && `${t.blocker_owner}待ち`].filter(Boolean).join('・')}
                      </span>
                    )}
                  </button>
                  <TaskMeta task={t} />
                  <button onClick={() => setOpenTaskId(t.id)} title="詳細" className="shrink-0 rounded-md p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {(canEdit || t.assignee_id === user?.id) && (
                    <button
                      onClick={() => {
                        if (confirm(`タスク「${t.title}」を削除しますか？`)) deleteTask(t)
                      }}
                      title="削除"
                      className="shrink-0 rounded-md p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-1 flex items-center gap-3 rounded-lg px-2 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-zinc-300 text-zinc-300">
                <Plus className="h-3.5 w-3.5" />
              </span>
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitTask()}
                placeholder="タイトルを「〜する」の形で入力して Enter"
                className="flex-1 bg-transparent text-sm text-zinc-700 outline-none placeholder:text-zinc-400"
              />
            </div>
          </section>

          {/* 成果物 */}
          <section className="mt-6 pb-6">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ChevronDown className="h-5 w-5" />
              成果物
            </h2>
            <div
              className={cn('mt-3 rounded-xl border p-4 transition-colors', dragOver ? 'border-brand bg-brand/5' : 'border-zinc-200')}
              onDragOver={(e) => {
                e.preventDefault()
                if (available) setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-500 focus-within:border-zinc-400">
                  <Search className="h-4 w-4 shrink-0 text-zinc-400" />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索" className="w-24 min-w-0 bg-transparent outline-none placeholder:text-zinc-400" />
                </div>
                <button onClick={() => setAsc((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50">
                  <ArrowUpDown className="h-4 w-4" />
                  {asc ? '名前↑' : '名前↓'}
                </button>
                <button
                  onClick={() => setLinkOpen((v) => !v)}
                  disabled={!available || busy}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                >
                  <Link2 className="h-4 w-4" />
                  リンク追加
                </button>
                <button onClick={() => fileRef.current?.click()} disabled={!available || busy} className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
                  <Plus className="h-4 w-4" />
                  {busy ? 'アップロード中…' : 'ファイル'}
                </button>
                <input ref={fileRef} type="file" onChange={onPick} className="hidden" />
              </div>

              {/* リンクで追加（動画はYouTube/Drive等のURLを貼る＝容量を食わない） */}
              {linkOpen && available && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
                  <input
                    autoFocus
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitLink()}
                    placeholder="URL（https://… 動画・Drive等）"
                    className="min-w-0 flex-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500"
                  />
                  <input
                    value={linkName}
                    onChange={(e) => setLinkName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitLink()}
                    placeholder="表示名（任意）"
                    className="w-40 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm outline-none focus:border-zinc-500"
                  />
                  <button
                    onClick={submitLink}
                    disabled={!linkUrl.trim() || busy}
                    className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    追加
                  </button>
                </div>
              )}

              {!available ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-amber-200 text-amber-400">
                    <Upload className="h-7 w-7" />
                  </div>
                  <p className="mt-4 font-bold text-zinc-600">成果物機能はまだ無効です</p>
                  <p className="mt-1 max-w-sm text-sm text-zinc-400">
                    <code className="rounded bg-zinc-100 px-1">db/deliverables.sql</code> を実行すると有効になります。
                  </p>
                </div>
              ) : shown.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 text-zinc-300">
                    <Upload className="h-7 w-7" />
                  </div>
                  <p className="mt-4 font-bold text-zinc-600">{q ? '一致する成果物がありません' : '成果物がありません'}</p>
                  {!q && <p className="mt-1 text-sm text-zinc-400">ファイルをドラッグ&ドロップ、または「新規作成」から追加</p>}
                </div>
              ) : (
                <ul className="mt-3 divide-y divide-zinc-100">
                  {shown.map((d) => (
                    <li key={d.id} className="flex items-center gap-2 py-2.5 text-sm">
                      {d.url ? (
                        <Link2 className="h-4 w-4 shrink-0 text-brand" />
                      ) : (
                        <FileText className="h-4 w-4 shrink-0 text-zinc-400" />
                      )}
                      <button onClick={() => openItem(d)} className="min-w-0 flex-1 truncate text-left text-zinc-700 hover:underline">
                        {d.name}
                      </button>
                      <span className="hidden shrink-0 text-xs text-zinc-400 sm:block">{fmt(d.created_at)}</span>
                      <button onClick={() => openItem(d)} title={d.url ? '開く' : 'ダウンロード'} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">
                        {d.url ? <ExternalLink className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                      </button>
                      <button onClick={() => remove(d)} title="削除" className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
          </>
          )}

          {/* === チャットタブ（本文には出さずここだけ） === */}
          {activeTab === 'chat' && (
            <section className="mt-4">
              <div className="h-[70vh] overflow-hidden rounded-xl border border-zinc-200">
                <CommentThread targetType="goal" targetId={goalId} members={members} className="h-full" />
              </div>
            </section>
          )}

          {/* ゴールの移動・削除（owner/admin）。大目標は事業設定でのみ扱うので出さない。 */}
          {canEdit && !isVisionGoal && (
            <div className="mt-6 flex flex-wrap gap-2 border-t border-zinc-100 pt-4">
              <button
                onClick={() => setShowMove(true)}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50"
              >
                <CornerUpRight className="h-4 w-4" />
                このゴールを移動
              </button>
              <button
                onClick={removeGoal}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                このゴールを削除
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 下固定の保存バー（中身タブのときだけ。どこからでも押せる） */}
      {activeTab === 'content' && canEdit && (
        <div className="shrink-0 border-t border-zinc-200 bg-white px-4 py-3 sm:px-8">
          <div className="mx-auto flex max-w-[920px] justify-end">
            <button
              onClick={saveInfo}
              disabled={savingInfo || !infoDirty}
              className="rounded-lg bg-brand px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {savingInfo ? '保存中…' : '保存'}
            </button>
          </div>
        </div>
      )}

      <TaskDetailModal
        taskId={openTaskId}
        open={!!openTaskId}
        onClose={() => setOpenTaskId(null)}
        onSaved={reloadTasks}
      />

      {goal && !isVisionGoal && (
        <MovePickerModal
          open={showMove}
          onClose={() => setShowMove(false)}
          item={{ kind: 'goal', id: goal.id, title: goal.title, parent_id: goal.parent_id }}
          onMoved={() => {
            reloadGoal()
            setCrumbBump((b) => b + 1)
          }}
        />
      )}
    </div>
  )
}

// タスクの並び順：詰まり(最上部・赤) → 進行中 → 未着手 → 完了
const TASK_ORDER = { blocked: 0, doing: 1, todo: 2, done: 3 }
const BLOCKER_JP = { data: 'データ待ち', approval: '承認待ち', reply: '返信待ち', external: '外部待ち' }
const PHASE_OPTS = [
  { v: 'now', label: '今ここ', dot: 'bg-lantern' },
  { v: 'next', label: '次', dot: 'bg-amber-400' },
  { v: 'later', label: 'あとで', dot: 'bg-zinc-300' },
]

const inputCls =
  'w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500'
// textarea用：枠内スクロールを無くし、中身に合わせて高さが伸びる
const taCls =
  'block w-full resize-none overflow-hidden rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm leading-relaxed outline-none focus:border-zinc-500'

// 中身の量に合わせて高さが自動で伸びる入力欄（枠内スクロールをなくす）
function AutoTextarea({ value, minRows = 2, className, ...props }) {
  const ref = useRef(null)
  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  useLayoutEffect(fit, [value])
  return <textarea ref={ref} rows={minRows} value={value} onInput={fit} className={className} {...props} />
}

function InfoField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

function ReadVal({ v }) {
  return <p className="whitespace-pre-wrap text-sm text-zinc-700">{v || <span className="text-zinc-400">—</span>}</p>
}

// 折りたたみ式の項目。畳んだ状態はヘッダーに1行プレビュー、開くとその場で編集。
function CollapsibleField({ label, value, accent, open, onToggle, children }) {
  const preview = String(value || '').split('\n')[0].trim()
  return (
    <div className={cn('rounded-xl border', accent ? 'border-terracotta/40 bg-terracotta/5' : 'border-zinc-200')}>
      <button onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        {open ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400" />}
        <span className={cn('shrink-0 text-xs font-semibold', accent ? 'text-terracotta' : 'text-zinc-500')}>{label}</span>
        {!open && (
          <span className="min-w-0 flex-1 truncate text-sm text-zinc-500">
            {preview || <span className="text-zinc-300">未記入</span>}
          </span>
        )}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
