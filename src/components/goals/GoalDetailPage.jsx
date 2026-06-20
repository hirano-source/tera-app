import { useEffect, useRef, useState, useMemo } from 'react'
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
} from 'lucide-react'
import { useGoal } from '../../hooks/useGoals'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useDeliverables } from '../../hooks/useDeliverables'
import { useGoalTasks } from '../../hooks/useGoalTasks'
import { supabase } from '../../utils/supabaseClient'
import { cn } from '../../utils/cn'
import CommentThread from '../comments/CommentThread'
import TaskDetailModal from '../tasks/TaskDetailModal'
import TaskMeta from '../tasks/TaskMeta'

// ゴール詳細 画面 (/goals/:id)。PC=2ペイン（左:内容／右:常駐チャット）。
// 左: パンくず＋タイトル＋ゴール情報＋タスク＋成果物。右: コメント/会話の蓄積。
export default function GoalDetailPage() {
  const { goalId } = useParams()
  const navigate = useNavigate()
  const { goal, loading, saveGoal, deleteGoal } = useGoal(goalId)
  const { current, currentId } = useWorkspace()
  const canEdit = ['owner', 'admin'].includes(current?.role)
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
  }, [currentId, goalId])

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

  if (loading || !goal) {
    return <div className="flex h-full items-center justify-center text-zinc-400">読み込み中…</div>
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
    <div className="flex h-full flex-col lg:flex-row">
      {/* 左：内容（スクロール） */}
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

          {/* タイトル */}
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 px-6 py-8 text-center">
            <h1 className="text-2xl font-bold tracking-wide sm:text-3xl">{goal.title}</h1>
          </div>

          {/* ゴール情報 */}
          <section className="mt-4 space-y-4 rounded-2xl border border-zinc-200 p-5">
            <InfoField label="ゴール名">
              {canEdit ? (
                <input
                  value={info.title}
                  onChange={(e) => setInfo((p) => ({ ...p, title: e.target.value }))}
                  className={inputCls}
                />
              ) : (
                <ReadVal v={goal.title} />
              )}
            </InfoField>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoField label="理想の状態">
                {canEdit ? (
                  <textarea rows={2} value={info.ideal_state} onChange={(e) => setInfo((p) => ({ ...p, ideal_state: e.target.value }))} placeholder="達成したらどうなっているか" className={inputCls} />
                ) : (
                  <ReadVal v={goal.ideal_state} />
                )}
              </InfoField>
              <InfoField label="現状">
                {canEdit ? (
                  <textarea rows={2} value={info.current} onChange={(e) => setInfo((p) => ({ ...p, current: e.target.value }))} placeholder="今どういう状態か" className={inputCls} />
                ) : (
                  <ReadVal v={goal.current} />
                )}
              </InfoField>
              <InfoField label="その差">
                {canEdit ? (
                  <textarea rows={2} value={info.gap} onChange={(e) => setInfo((p) => ({ ...p, gap: e.target.value }))} placeholder="理想と現状のギャップ・足りないもの" className={inputCls} />
                ) : (
                  <ReadVal v={goal.gap} />
                )}
              </InfoField>
              <InfoField label="完了の基準">
                {canEdit ? (
                  <textarea rows={2} value={info.criteria} onChange={(e) => setInfo((p) => ({ ...p, criteria: e.target.value }))} placeholder="何ができたら完了か" className={inputCls} />
                ) : (
                  <ReadVal v={goal.criteria} />
                )}
              </InfoField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoField label="期日">
                {canEdit ? (
                  <input type="date" value={info.due_date || ''} onChange={(e) => setInfo((p) => ({ ...p, due_date: e.target.value }))} className={inputCls} />
                ) : (
                  <ReadVal v={goal.due_date} />
                )}
              </InfoField>
              <InfoField label="担当">
                {canEdit ? (
                  <select value={info.owner_id || ''} onChange={(e) => setInfo((p) => ({ ...p, owner_id: e.target.value }))} className={inputCls}>
                    <option value="">未割当</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                ) : (
                  <ReadVal v={members.find((m) => m.id === goal.owner_id)?.name} />
                )}
              </InfoField>
            </div>
            {canEdit && infoDirty && (
              <div className="flex justify-end">
                <button onClick={saveInfo} disabled={savingInfo} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
                  {savingInfo ? '保存中…' : '保存'}
                </button>
              </div>
            )}
          </section>

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
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-zinc-50">
                  <button
                    onClick={() => toggleTask(t)}
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                      t.status === 'done' ? 'bg-emerald-500 text-white' : 'bg-brand text-white',
                    )}
                  >
                    {t.status === 'done' ? <Check className="h-3 w-3" strokeWidth={3} /> : <Play className="h-2.5 w-2.5 translate-x-0.5 fill-white" />}
                  </button>
                  <button
                    onClick={() => setOpenTaskId(t.id)}
                    className={cn('flex-1 truncate text-left text-sm', t.status === 'done' ? 'text-zinc-400 line-through' : 'text-zinc-700')}
                  >
                    {t.title}
                  </button>
                  <TaskMeta task={t} />
                  <button onClick={() => setOpenTaskId(t.id)} title="詳細" className="shrink-0 rounded-md p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-600">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  {canEdit && (
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

          {/* ゴール削除（owner/admin） */}
          {canEdit && (
            <div className="mt-6 border-t border-zinc-100 pt-4">
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

      {/* 右：常駐チャット（PCは右カラム／スマホは下に積む） */}
      <aside className="flex max-h-[45vh] shrink-0 flex-col border-t border-zinc-200 lg:max-h-none lg:w-[360px] lg:border-l lg:border-t-0">
        <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 font-bold">
          <MessageSquare className="h-5 w-5 text-zinc-500" />
          チャット
        </div>
        <CommentThread targetType="goal" targetId={goalId} members={members} className="flex-1" />
      </aside>

      <TaskDetailModal
        taskId={openTaskId}
        open={!!openTaskId}
        onClose={() => setOpenTaskId(null)}
        onSaved={reloadTasks}
      />
    </div>
  )
}

const inputCls =
  'w-full resize-none rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500'

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

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
