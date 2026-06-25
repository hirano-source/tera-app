import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { X, Trash2, Bot } from 'lucide-react'
import { supabase } from '../../utils/supabaseClient'
import { useWorkspace } from '../../hooks/useWorkspace'
import CommentThread from '../comments/CommentThread'
import { cn } from '../../utils/cn'

// タスクの詳細（右からのドロワー）。クリックで開き、6項目を表示／編集する。
// 入力は基本Claude(MCP)が埋める想定だが、ここで人が直接いじることもできる。
const STATUS = [
  { v: 'todo', label: '未着手' },
  { v: 'doing', label: '進行中' },
  { v: 'blocked', label: '待ち（詰まり）' },
  { v: 'done', label: '完了' },
]
const PRIORITY = [
  { v: 'P0', label: 'P0 今日中' },
  { v: 'P1', label: 'P1 今週中' },
  { v: 'P2', label: 'P2 来週中' },
  { v: 'P3', label: 'P3 〆切あり' },
  { v: 'P4', label: 'P4 いつか' },
]
const RECURRENCE = [
  { v: '', label: '重点案件（1回限り）' },
  { v: 'daily', label: '毎日' },
  { v: 'weekly', label: '毎週' },
  { v: 'monthly', label: '毎月' },
]
const BLOCKER = [
  { v: '', label: '—' },
  { v: 'data', label: 'データ待ち' },
  { v: 'approval', label: '承認待ち' },
  { v: 'reply', label: '返信待ち' },
  { v: 'external', label: '外部待ち' },
]
const taCls = 'block w-full resize-none overflow-hidden rounded-lg border border-zinc-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-zinc-500'
const dateCls = 'w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-zinc-500'

export default function TaskDetailModal({ taskId, open, onClose, onSaved }) {
  const { current, currentId, user } = useWorkspace()
  const isAdmin = ['owner', 'admin'].includes(current?.role)
  const [t, setT] = useState(null)
  // 削除はowner/admin、または自分が主担当のタスクなら可（RLSと一致）
  const canDelete = isAdmin || (!!t?.assignee_id && t.assignee_id === user?.id)
  const [busy, setBusy] = useState(false)
  const [members, setMembers] = useState([])
  const [assignees, setAssignees] = useState([]) // 担当（複数）user_id配列
  const [showDeep, setShowDeep] = useState(false) // 理想/現状/差（深掘り）の表示

  useEffect(() => {
    if (!open || !taskId) return
    setT(null)
    setShowDeep(false)
    let active = true
    ;(async () => {
      const { data } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle()
      if (!active) return
      setT(data)
      // 複数担当の現状を読む
      const { data: ta } = await supabase.from('task_assignees').select('user_id').eq('task_id', taskId)
      const ids = (ta ?? []).map((x) => x.user_id)
      // 主担当(assignee_id)も担当集合に含める
      if (data?.assignee_id && !ids.includes(data.assignee_id)) ids.push(data.assignee_id)
      if (active) setAssignees(ids)
    })()
    return () => {
      active = false
    }
  }, [open, taskId])

  // メンバー一覧（担当ピッカー用）
  useEffect(() => {
    if (!open || !currentId) return
    let active = true
    ;(async () => {
      const { data: mem } = await supabase.from('memberships').select('user_id').eq('workspace_id', currentId)
      const ids = (mem ?? []).map((m) => m.user_id)
      if (ids.length) {
        const { data: us } = await supabase.from('users').select('id,name,avatar_color,is_bot').in('id', ids)
        if (active) setMembers(us ?? [])
      }
    })()
    return () => {
      active = false
    }
  }, [open, currentId])

  const toggleAssignee = (id) =>
    setAssignees((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))

  if (!open) return null

  const set = (k, v) => setT((p) => ({ ...p, [k]: v }))

  const save = async () => {
    if (!t) return
    setBusy(true)
    const blocked = t.status === 'blocked'
    const patch = {
      title: t.title,
      status: t.status,
      priority: t.priority || 'P2',
      is_today: !!t.is_today,
      recurrence: t.recurrence || null,
      start_due_date: t.start_due_date || null,
      due_date: t.due_date || null,
      ideal_state: t.ideal_state || null,
      current_state: t.current_state || null,
      gap: t.gap || null,
      approach: t.approach || null,
      completion_criteria: t.completion_criteria || null,
      assignee_id: assignees[0] ?? null, // 主担当＝先頭
      blocker_type: blocked ? t.blocker_type || null : null,
      blocker_owner: blocked ? t.blocker_owner || null : null,
      blocker_note: blocked ? t.blocker_note || null : null,
      blocker_since: blocked ? t.blocker_since || new Date().toISOString() : null,
    }
    const { error } = await supabase.from('tasks').update(patch).eq('id', t.id)
    if (!error) {
      // 複数担当を同期：一旦消して、選択中を入れ直す
      await supabase.from('task_assignees').delete().eq('task_id', t.id)
      if (assignees.length && currentId) {
        await supabase
          .from('task_assignees')
          .insert(assignees.map((uid) => ({ task_id: t.id, user_id: uid, workspace_id: currentId })))
      }
    }
    setBusy(false)
    if (error) {
      alert('保存に失敗しました: ' + error.message)
      return
    }
    onSaved?.()
    onClose()
  }

  const remove = async () => {
    if (!t) return
    if (!confirm(`タスク「${t.title}」を削除しますか？\n元に戻せません。（完了にするだけなら「保存」で状態を完了にしてください）`)) return
    setBusy(true)
    const { error } = await supabase.from('tasks').delete().eq('id', t.id)
    setBusy(false)
    if (error) {
      alert('削除に失敗しました: ' + error.message)
      return
    }
    onSaved?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-lg flex-col bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h3 className="font-bold">タスクの詳細</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!t ? (
          <div className="grid flex-1 place-items-center text-zinc-400">読み込み中…</div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {/* タイトル＝見出しとして大きく（枠は控えめ） */}
            <input
              value={t.title || ''}
              onChange={(e) => set('title', e.target.value)}
              placeholder="タイトル"
              className="w-full rounded-lg border border-transparent px-2 py-1.5 text-lg font-semibold text-zinc-900 outline-none hover:border-zinc-200 focus:border-zinc-300"
            />

            {/* 属性：状態・優先度・期限・区分・今日・担当を1か所に凝縮＝ぱっと見て分かる */}
            <div className="space-y-2.5 rounded-xl bg-zinc-50 p-3">
              <div className="grid grid-cols-2 gap-2.5">
                <Field label="状態">
                  <Select value={t.status || 'todo'} onChange={(v) => set('status', v)} options={STATUS} />
                </Field>
                <Field label="優先度">
                  <Select value={t.priority || 'P2'} onChange={(v) => set('priority', v)} options={PRIORITY} />
                </Field>
                <Field label="着手期限">
                  <input type="date" value={t.start_due_date || ''} onChange={(e) => set('start_due_date', e.target.value)} className={dateCls} />
                </Field>
                <Field label="完了期限">
                  <input type="date" value={t.due_date || ''} onChange={(e) => set('due_date', e.target.value)} className={dateCls} />
                </Field>
                <Field label="区分">
                  <Select value={t.recurrence || ''} onChange={(v) => set('recurrence', v)} options={RECURRENCE} />
                </Field>
                <Field label="今日のToDo">
                  <button
                    type="button"
                    onClick={() => set('is_today', !t.is_today)}
                    className={cn(
                      'h-[38px] w-full rounded-lg border text-sm',
                      t.is_today ? 'border-brand bg-brand/10 font-medium text-brand' : 'border-zinc-300 text-zinc-500',
                    )}
                  >
                    {t.is_today ? '今日やる' : '予定だけ'}
                  </button>
                </Field>
              </div>
              <Field label="担当（複数可）">
                <div className="flex flex-wrap gap-1.5">
                  {members.map((m) => {
                    const on = assignees.includes(m.id)
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleAssignee(m.id)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
                          on ? 'border-brand bg-brand/10 text-brand' : 'border-zinc-300 bg-white text-zinc-500 hover:bg-zinc-50',
                        )}
                      >
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
                          style={{ backgroundColor: m.avatar_color || '#6d5dfc' }}
                        >
                          {m.is_bot ? <Bot className="h-2.5 w-2.5" /> : (m.name || '?').charAt(0).toUpperCase()}
                        </span>
                        {m.name}
                      </button>
                    )
                  })}
                  {members.length === 0 && <span className="text-xs text-zinc-400">メンバーがいません</span>}
                </div>
              </Field>
            </div>

            {/* やること・完了基準＝主役。スクロールせず見える位置に。 */}
            <Field label="やること">
              <AutoTextarea value={t.approach || ''} onChange={(e) => set('approach', e.target.value)} placeholder="差を埋める具体的な一手" className={taCls} />
            </Field>
            <Field label="完了の基準（できた／できてないの判断）">
              <AutoTextarea value={t.completion_criteria || ''} onChange={(e) => set('completion_criteria', e.target.value)} placeholder="何ができたら完了と言えるか" className={taCls} />
            </Field>

            {/* 深掘り（理想→現状→差）：中身がある／開いたときだけ表示＝ふだんは短く */}
            {showDeep || t.ideal_state || t.current_state || t.gap ? (
              <div className="space-y-3">
                <Field label="理想の状態">
                  <AutoTextarea value={t.ideal_state || ''} onChange={(e) => set('ideal_state', e.target.value)} placeholder="終わったらどうなってるか" className={taCls} />
                </Field>
                <Field label="現状">
                  <AutoTextarea value={t.current_state || ''} onChange={(e) => set('current_state', e.target.value)} placeholder="今どうなってるか" className={taCls} />
                </Field>
                <Field label="その差">
                  <AutoTextarea value={t.gap || ''} onChange={(e) => set('gap', e.target.value)} placeholder="理想と現状のギャップ・詰まり" className={taCls} />
                </Field>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeep(true)}
                className="text-xs font-medium text-zinc-400 hover:text-zinc-600"
              >
                ＋ 深掘り（理想・現状・差）を追加
              </button>
            )}

            {t.status === 'blocked' && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-800">ブロッカー（詰まり）</p>
                <Field label="種類">
                  <Select value={t.blocker_type || ''} onChange={(v) => set('blocker_type', v)} options={BLOCKER} />
                </Field>
                <Field label="誰待ち">
                  <input
                    value={t.blocker_owner || ''}
                    onChange={(e) => set('blocker_owner', e.target.value)}
                    placeholder="例: 蓑田先生"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  />
                </Field>
                <Field label="メモ">
                  <AutoTextarea
                    value={t.blocker_note || ''}
                    onChange={(e) => set('blocker_note', e.target.value)}
                    className={taCls}
                  />
                </Field>
              </div>
            )}

            {/* コメント / 議事録（このタスクに文脈が溜まる。Claudeも書き込める） */}
            <div>
              <span className="mb-1 block text-xs font-medium text-zinc-500">コメント / 議事録</span>
              <div className="h-56 overflow-hidden rounded-lg border border-zinc-200">
                <CommentThread targetType="task" targetId={t.id} members={members} className="h-full" />
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-zinc-200 px-5 py-3">
          {canDelete && (
            <button
              onClick={remove}
              disabled={busy || !t}
              title="タスクを削除"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50 disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
              削除
            </button>
          )}
          <button
            onClick={save}
            disabled={busy || !t}
            className="flex-1 rounded-lg bg-brand py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}

// 中身の量に合わせて高さが自動で伸びる入力欄。
// 枠内スクロールをなくし、書いた内容がそのまま全部見えるようにする。
function AutoTextarea({ value, minRows = 2, className, ...props }) {
  const ref = useRef(null)
  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  // 中身が変わるたび／開いた直後に高さを合わせ直す
  useLayoutEffect(fit, [value])
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      onInput={fit}
      className={className}
      {...props}
    />
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm outline-none focus:border-zinc-500"
    >
      {options.map((o) => (
        <option key={o.v} value={o.v}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
