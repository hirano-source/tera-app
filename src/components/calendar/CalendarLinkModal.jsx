import { useState } from 'react'
import { X, CalendarDays, Link2, Eye, Trash2, Plus, ExternalLink } from 'lucide-react'

// カレンダー連携モーダル。iCal/ICS URL を複数登録するUI。
const STEPS = [
  'Googleカレンダーを開き、「設定」を開く',
  '左側の「マイカレンダーの設定」から共有したいカレンダーを選ぶ',
  '「カレンダーの統合」までスクロールし、「iCal形式の公開URL」または「iCal形式の非公開URL」をコピーする',
  'コピーしたURLを下の入力欄に貼り付けて保存する',
]

export default function CalendarLinkModal({ open, onClose }) {
  const [urls, setUrls] = useState([''])
  if (!open) return null

  const updateUrl = (i, v) => setUrls((u) => u.map((x, idx) => (idx === i ? v : x)))
  const addUrl = () => setUrls((u) => [...u, ''])
  const removeUrl = (i) => setUrls((u) => u.filter((_, idx) => idx !== i))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[760px] rounded-2xl bg-white p-7 shadow-xl">
        {/* ヘッダ */}
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold">カレンダー連携</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
          GoogleカレンダーなどのiCal / ICS URLを登録すると、今日の予定が今日のToDoに表示されます。複数登録する場合はURLごとに入力欄を追加してください。
        </p>

        {/* 手順カード */}
        <div className="mt-5 rounded-xl border border-zinc-200 p-5">
          <div className="flex items-center gap-2 font-bold">
            <CalendarDays className="h-5 w-5" />
            GoogleカレンダーのICS URLを取得する手順
          </div>
          <ol className="mt-3 space-y-2.5">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-zinc-500">
                <span className="shrink-0 font-semibold text-zinc-400">{i + 1}</span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex gap-2 text-xs leading-relaxed text-zinc-400">
            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              非公開URLを使う場合、そのURLを知っている人は予定を読めます。TERAでは完了状態だけを保存し、カレンダー本体には書き戻しません。
            </span>
          </div>
        </div>

        {/* URL入力 */}
        <div className="mt-6">
          <label className="text-sm font-bold">iCal / ICS URL</label>
          <div className="mt-2 space-y-2">
            {urls.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-lg border border-zinc-300 px-3 py-2.5 focus-within:border-zinc-400">
                  <Link2 className="h-4 w-4 text-zinc-400" />
                  <input
                    value={url}
                    onChange={(e) => updateUrl(i, e.target.value)}
                    placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                  />
                  <Eye className="h-4 w-4 text-zinc-400" />
                </div>
                <button
                  onClick={() => removeUrl(i)}
                  className="rounded-lg border border-zinc-200 p-2.5 text-zinc-400 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addUrl}
            className="mt-2 flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
          >
            <Plus className="h-4 w-4" />
            URLを追加
          </button>
        </div>

        {/* フッター */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            キャンセル
          </button>
          <button className="rounded-lg bg-zinc-300 px-6 py-2 text-sm font-medium text-white">
            保存
          </button>
        </div>
      </div>
    </div>
  )
}
