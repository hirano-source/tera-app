import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../utils/supabaseClient'

// タスクの詳細（右からのドロワー）。クリックで開き、6項目を表示／編集する。
// 入力は基本Claude(MCP)が埋める想定だが、ここで人が直接いじることもできる。
const STATUS = [
  { v: 'todo', label: '未着手' },
  { v: 'doing', label: '着手' },
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

export default function TaskDetailModal({ taskId, open, onClose, onSaved }) {
  const [t, setT] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !taskId) return
    setT(null)
    let active = true
    supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setT(data)
      })
    return () => {
      active = false
    }
  }, [open, taskId])

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
      recurrence: t.recurrence || null,
      start_due_date: t.start_due_date || null,
      due_date: t.due_date || null,
      completion_criteria: t.completion_criteria || null,
      approach: t.approach || null,
      blocker_type: blocked ? t.blocker_type || null : null,
      blocker_owner: blocked ? t.blocker_owner || null : null,
      blocker_note: blocked ? t.blocker_note || null : null,
      blocker_since: blocked ? t.blocker_since || new Date().toISOString() : null,
    }
    const { error } = await supabase.from('tasks').update(patch).eq('id', t.id)
    setBusy(false)
    if (error) {
      alert('保存に失敗しました: ' + error.message)
      return
    }
    onSaved?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-xl"
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
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <Field label="タイトル">
              <input
                value={t.title || ''}
                onChange={(e) => set('title', e.target.value)}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="状態">
                <Select value={t.status || 'todo'} onChange={(v) => set('status', v)} options={STATUS} />
              </Field>
              <Field label="優先度">
                <Select value={t.priority || 'P2'} onChange={(v) => set('priority', v)} options={PRIORITY} />
              </Field>
            </div>

            <Field label="区分">
              <Select value={t.recurrence || ''} onChange={(v) => set('recurrence', v)} options={RECURRENCE} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="着手期限">
                <input
                  type="date"
                  value={t.start_due_date || ''}
                  onChange={(e) => set('start_due_date', e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </Field>
              <Field label="完了期限">
                <input
                  type="date"
                  value={t.due_date || ''}
                  onChange={(e) => set('due_date', e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                />
              </Field>
            </div>

            <Field label="完了の基準（何ができたら完了か）">
              <textarea
                rows={2}
                value={t.completion_criteria || ''}
                onChange={(e) => set('completion_criteria', e.target.value)}
                className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </Field>

            <Field label="やり方 / 最初の一歩">
              <textarea
                rows={2}
                value={t.approach || ''}
                onChange={(e) => set('approach', e.target.value)}
                className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
              />
            </Field>

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
                  <textarea
                    rows={2}
                    value={t.blocker_note || ''}
                    onChange={(e) => set('blocker_note', e.target.value)}
                    className="w-full resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                  />
                </Field>
              </div>
            )}
          </div>
        )}

        <div className="border-t border-zinc-200 px-5 py-3">
          <button
            onClick={save}
            disabled={busy || !t}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
          >
            {busy ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </div>
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
