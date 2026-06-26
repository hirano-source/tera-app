import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Target, ChevronRight, ChevronDown, MessageSquare, Bot, AlertTriangle } from 'lucide-react'
import { useWorkspace } from '../../hooks/useWorkspace'
import { useGoal } from '../../hooks/useGoals'
import { useVisionData } from '../../hooks/useVisionData'
import { formatMetric, daysUntil, PHASE_META } from '../../utils/goalView'
import CommentThread from '../comments/CommentThread'

// 大目標トップ＝ダッシュボード。開いた瞬間に「数字・残り日数・全体進捗・今うごかすゴール」が
// 1画面で分かる。長文4項目（理想/現状/差/基準）とチャットは下のアコーディオンに退避。
export default function VisionDashboard({ goalId }) {
  const { current } = useWorkspace()
  const canEdit = ['owner', 'admin'].includes(current?.role)
  const { goal, saveGoal, reload: reloadGoal } = useGoal(goalId)
  const { childGoals, overall, metrics, members, updateMetric } = useVisionData(goalId)
  const navigate = useNavigate()
  const [openInner, setOpenInner] = useState(false)
  const [openChat, setOpenChat] = useState(false)

  if (!goal) return <div className="grid h-full place-items-center text-zinc-400">読み込み中…</div>

  const remain = daysUntil(goal.due_date)
  const lanes = ['now', 'next', 'later']
  const byLane = (p) => childGoals.filter((c) => c.phase === p).sort((a, b) => b.progress - a.progress)

  return (
    <div className="mx-auto max-w-[760px] px-4 py-5 sm:px-8 sm:py-7">
      {/* ── ヒーロー（生成りサーフェスで温かみ） ── */}
      <section className="rounded-2xl border border-hairline bg-cream p-5 sm:p-6">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-terracotta">
          <Target className="h-4 w-4" /> 大目標
        </div>
        <h1 className="mt-1 line-clamp-2 text-xl font-extrabold leading-snug text-ink sm:text-2xl">
          {goal.title}
        </h1>

        <div className="mt-3 border-t border-hairline pt-3 text-sm text-sumi">
          {goal.due_date ? (
            <span className={remain !== null && remain <= 30 ? 'font-semibold text-lantern' : ''}>
              期日 {fmtDate(goal.due_date)} ・ 残り {remain} 日
            </span>
          ) : (
            <span className="text-sumi">期日 未設定</span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-terracotta" style={{ width: `${overall}%` }} />
          </div>
          <span className="shrink-0 text-sm font-bold tabular-nums text-ink">{overall}%</span>
        </div>

        {/* ── KPIタイル（数字が主役） ── */}
        {metrics.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {metrics.map((m) => (
              <MetricTile key={m.id} m={m} canEdit={canEdit} onSave={updateMetric} />
            ))}
          </div>
        )}
      </section>

      {/* ── レーン（今 / 次 / あとで） ── */}
      {lanes.map((p) => {
        const items = byLane(p)
        if (items.length === 0) return null
        return <Lane key={p} phase={p} items={items} members={members} onOpen={(id) => navigate(`/goals/${id}`)} />
      })}

      {childGoals.length === 0 && (
        <p className="mt-8 text-center text-sm text-zinc-400">
          まだ大目標の下にゴールがありません。ゴールを積むとここに並びます。
        </p>
      )}

      {/* ── アコーディオン：大目標の中身（編集） ── */}
      <Accordion title="大目標の中身（理想／現状／差／基準）" open={openInner} onToggle={() => setOpenInner((v) => !v)}>
        <InnerEditor goal={goal} canEdit={canEdit} saveGoal={saveGoal} onSaved={reloadGoal} />
      </Accordion>

      {/* ── アコーディオン：チャット（議事録） ── */}
      <Accordion title="チャット（議事録）" open={openChat} onToggle={() => setOpenChat((v) => !v)}>
        <div className="h-80 overflow-hidden rounded-lg border border-zinc-200">
          <CommentThread targetType="goal" targetId={goalId} members={Object.values(members)} className="h-full" />
        </div>
      </Accordion>
    </div>
  )
}

// KPIタイル：現在値を大きく、下に「/ 目標 単位」。タップで現在値をインライン編集。
function MetricTile({ m, canEdit, onSave }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const pct = m.target ? Math.min(100, Math.round((Number(m.current) / Number(m.target)) * 100)) : 0
  const startEdit = () => {
    if (!canEdit) return
    setVal(String(Number(m.current ?? 0)))
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    if (val !== '' && Number(val) !== Number(m.current)) onSave(m.id, val)
  }
  return (
    <div className="rounded-xl border border-hairline bg-white p-2.5 text-center sm:p-3">
      <div className="truncate text-[11px] font-semibold text-sumi">{m.label}</div>
      {editing ? (
        <input
          autoFocus
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="mt-1 w-full rounded border border-terracotta px-1 py-0.5 text-center text-base font-extrabold tabular-nums outline-none"
        />
      ) : (
        <button
          onClick={startEdit}
          className={'mt-1 block w-full truncate text-lg font-extrabold tabular-nums text-ink sm:text-xl ' + (canEdit ? 'hover:text-terracotta' : 'cursor-default')}
          title={canEdit ? 'タップで現在値を編集' : undefined}
        >
          {formatMetric(m.current, m.display_format)}
        </button>
      )}
      <div className="mt-0.5 text-[11px] text-sumi">
        / {formatMetric(m.target, m.display_format)}
        {m.display_format === 'count' ? m.unit : ''}
        {m.key === 'income_pp' && <span className="ml-0.5 text-[10px] text-zinc-400">×2名</span>}
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-hairline">
        <div className="h-full rounded-full bg-terracotta" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Lane({ phase, items, members, onOpen }) {
  const meta = PHASE_META[phase]
  const [collapsed, setCollapsed] = useState(phase === 'later')
  return (
    <section className="mt-6">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="mb-2 flex w-full items-center gap-2 text-left"
      >
        <span className={'h-2.5 w-2.5 shrink-0 rounded-full ' + meta.dot} />
        <span className="text-sm font-bold text-ink">{meta.label}</span>
        <span className="text-xs text-zinc-400">{items.length}</span>
        {phase === 'later' && (collapsed ? <ChevronRight className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />)}
      </button>
      {!collapsed && (
        <div className="space-y-2">
          {items.map((c) => (
            <GoalCard key={c.id} c={c} phase={phase} member={members[c.owner_id]} onOpen={() => onOpen(c.id)} />
          ))}
        </div>
      )}
    </section>
  )
}

function GoalCard({ c, phase, member, onOpen }) {
  const dim = phase !== 'now'
  return (
    <button
      onClick={onOpen}
      className={
        'block w-full rounded-xl border p-3 text-left transition hover:shadow-sm ' +
        (dim ? 'border-zinc-200 bg-zinc-50/60' : 'border-hairline bg-white')
      }
    >
      <div className="flex items-center gap-2">
        <span className={'min-w-0 flex-1 truncate text-[15px] font-bold ' + (dim ? 'text-sumi' : 'text-ink')}>
          {c.title}
        </span>
        {c.blockedCount > 0 && (
          <span className="flex shrink-0 items-center gap-0.5 rounded bg-lantern/10 px-1.5 py-0.5 text-[11px] font-medium text-lantern">
            <AlertTriangle className="h-3 w-3" /> 詰まり{c.blockedCount}
          </span>
        )}
        <span className="shrink-0 text-sm font-bold tabular-nums text-sumi">{c.progress}%</span>
      </div>

      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-hairline">
        <div className={'h-full rounded-full ' + (dim ? 'bg-zinc-300' : 'bg-terracotta')} style={{ width: `${c.progress}%` }} />
      </div>

      <div className="mt-1.5 flex items-center gap-2 text-xs text-sumi">
        {c.taskTotal > 0 ? (
          <span className="shrink-0">タスク {c.taskDone}/{c.taskTotal}</span>
        ) : (
          <span className="shrink-0 text-zinc-400">まだタスクなし — 分解する</span>
        )}
        {phase === 'now' && c.next && <span className="min-w-0 flex-1 truncate">・ 次: {c.next.title}</span>}
        {phase === 'next' && <span className="min-w-0 flex-1 truncate">・ 前提: {c.gateNote ?? '着手前'}</span>}
        {phase === 'later' && <span className="min-w-0 flex-1 truncate">・ PMF後</span>}
        {member && <Avatar user={member} />}
      </div>
    </button>
  )
}

function Avatar({ user }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: user.avatar_color || '#6d5dfc' }}
      title={user.is_bot ? `${user.name}（AI）` : user.name}
    >
      {user.is_bot ? <Bot className="h-3 w-3" /> : (user.name || '?').charAt(0).toUpperCase()}
    </span>
  )
}

function Accordion({ title, open, onToggle, children }) {
  return (
    <div className="mt-6 border-t border-zinc-200 pt-3">
      <button onClick={onToggle} className="flex w-full items-center gap-1.5 text-left text-sm font-semibold text-zinc-600">
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

// 大目標の理想/現状/差/基準/期日の編集（アコーディオン内）。
function InnerEditor({ goal, canEdit, saveGoal, onSaved }) {
  const [f, setF] = useState({
    ideal_state: goal.ideal_state ?? '',
    current: goal.current ?? '',
    gap: goal.gap ?? '',
    criteria: goal.criteria ?? '',
    due_date: goal.due_date ?? '',
  })
  const [busy, setBusy] = useState(false)
  const dirty =
    f.ideal_state !== (goal.ideal_state ?? '') ||
    f.current !== (goal.current ?? '') ||
    f.gap !== (goal.gap ?? '') ||
    f.criteria !== (goal.criteria ?? '') ||
    f.due_date !== (goal.due_date ?? '')
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }))
  const save = async () => {
    setBusy(true)
    try {
      await saveGoal({ ...f, due_date: f.due_date || null })
      onSaved?.()
    } catch (e) {
      alert('保存に失敗しました: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }
  const cls = 'block w-full resize-y rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500'
  if (!canEdit) {
    return (
      <div className="space-y-3 text-sm">
        <ReadField label="理想の状態" v={goal.ideal_state} />
        <ReadField label="現状" v={goal.current} />
        <ReadField label="その差" v={goal.gap} />
        <ReadField label="完了の基準" v={goal.criteria} />
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <L label="理想の状態"><textarea rows={2} value={f.ideal_state} onChange={(e) => set('ideal_state', e.target.value)} className={cls} /></L>
      <L label="現状"><textarea rows={2} value={f.current} onChange={(e) => set('current', e.target.value)} className={cls} /></L>
      <L label="その差"><textarea rows={2} value={f.gap} onChange={(e) => set('gap', e.target.value)} className={cls} /></L>
      <L label="完了の基準"><textarea rows={2} value={f.criteria} onChange={(e) => set('criteria', e.target.value)} className={cls} /></L>
      <L label="期日"><input type="date" value={f.due_date || ''} onChange={(e) => set('due_date', e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500" /></L>
      <div className="flex justify-end">
        <button onClick={save} disabled={busy || !dirty} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40">
          {busy ? '保存中…' : '保存'}
        </button>
      </div>
    </div>
  )
}

function L({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  )
}
function ReadField({ label, v }) {
  return (
    <div>
      <span className="mb-0.5 block text-xs text-zinc-500">{label}</span>
      <p className="whitespace-pre-wrap text-zinc-700">{v || <span className="text-zinc-400">未記入</span>}</p>
    </div>
  )
}

function fmtDate(d) {
  const p = String(d).slice(0, 10).split('-')
  return p.length < 3 ? d : `${p[0]}/${Number(p[1])}/${Number(p[2])}`
}
