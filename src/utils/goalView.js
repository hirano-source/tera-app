// 大目標ダッシュボード用の共通ロジック（レーン導出・KPI整形・次の一手）。

// 優先度の重み（小さいほど急ぎ）。null/未設定は最後尾扱い。
const PRIO_RANK = { P0: 0, P1: 1, P2: 2, P3: 3, P4: 4 }
export const prioRank = (p) => (p in PRIO_RANK ? PRIO_RANK[p] : 9)

// ゴールの進捗％：配下タスクの完了割合（あれば）を優先、無ければ goals.progress。
export function goalProgress(goal, tasks) {
  const total = tasks.length
  if (total > 0) {
    const done = tasks.filter((t) => t.status === 'done').length
    return Math.floor((done / total) * 100)
  }
  return goal.progress ?? 0
}

// レーン（now/next/later）の自動導出。手動 phase があればそれを優先（呼び出し側で）。
//  now  : 進捗1〜99 / 未完了のP0・P1あり / is_todayの未完了あり
//  later: タスク0件 / 未完了がP3・P4(または無印)のみ
//  next : 上記以外（着手前・前提待ち）。詰まりがあれば next。
export function derivePhase(goal, tasks) {
  const prog = goalProgress(goal, tasks)
  const incomplete = tasks.filter((t) => t.status !== 'done')
  const hasP01 = incomplete.some((t) => t.priority === 'P0' || t.priority === 'P1')
  const hasToday = incomplete.some((t) => t.is_today)
  if ((prog >= 1 && prog <= 99) || hasP01 || hasToday) return 'now'
  if (tasks.length === 0) return 'later'
  const onlyLow = incomplete.length > 0 && incomplete.every((t) => prioRank(t.priority) >= 3)
  if (onlyLow) return 'later'
  return 'next'
}

// 「次の一手」：未完了タスクのうち最優先（P0>P1…、同位は期日が近い順）を1件。
export function nextTask(tasks) {
  const open = tasks.filter((t) => t.status !== 'done')
  if (open.length === 0) return null
  return [...open].sort((a, b) => {
    const r = prioRank(a.priority) - prioRank(b.priority)
    if (r !== 0) return r
    return String(a.due_date ?? '9999').localeCompare(String(b.due_date ?? '9999'))
  })[0]
}

// KPIの現在値/目標を表示用に整形する。
//  count   : 1000 → "1,000"
//  yen_oku : 200000000 → "¥2億"（端数は小数1桁まで）／0 → "¥0"
//  yen_man : 3000000 → "¥300万"
export function formatMetric(value, format) {
  const n = Number(value ?? 0)
  if (format === 'yen_oku') return '¥' + trimNum(n / 100000000) + (n === 0 ? '' : '億')
  if (format === 'yen_man') return '¥' + trimNum(n / 10000) + (n === 0 ? '' : '万')
  return n.toLocaleString('ja-JP')
}
const trimNum = (x) => {
  const r = Math.round(x * 10) / 10
  return Number.isInteger(r) ? String(r) : r.toFixed(1)
}

// 期日までの残り日数（過去なら負）。
export function daysUntil(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(String(dateStr).slice(0, 10) + 'T00:00:00')
  return Math.round((d - today) / 86400000)
}

export const PHASE_META = {
  now: { label: '今うごかす', dot: 'bg-lantern', note: null },
  next: { label: '次（前提待ち）', dot: 'bg-amber-400', note: null },
  later: { label: 'あとで（PMF後）', dot: 'bg-zinc-300', note: null },
}
