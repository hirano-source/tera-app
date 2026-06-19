import { useState } from 'react'
import { Users, UserPlus, AlertTriangle, Activity } from 'lucide-react'
import { useTeam } from '../../hooks/useTeam'
import { useWorkspace } from '../../hooks/useWorkspace'
import { cn } from '../../utils/cn'
import InviteModal from './InviteModal'

const ROLE_LABEL = { owner: 'オーナー', admin: '管理者', member: 'メンバー' }

// メンバー / チームダッシュボード 画面 (/members)。
// メンバー別に「今やっていること・進捗・blocked・最終活動」を可視化する。
export default function MembersPage() {
  const { members, loading, error, assignTask, setRole } = useTeam()
  const { current } = useWorkspace()
  const canManage = ['owner', 'admin'].includes(current?.role)
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <div className="mx-auto max-w-[1100px] px-10 py-8">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Users className="h-6 w-6" />
          チームの状況
        </h1>
        <button
          onClick={() => setInviteOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <UserPlus className="h-4 w-4" />
          メンバーを招待
        </button>
      </div>

      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <p className="mt-1 text-sm text-zinc-400">
        誰が・何を・どこまでやっているかが一目で分かります
      </p>

      <hr className="my-5 border-zinc-200" />

      {error ? (
        <div className="py-16 text-center">
          <p className="font-medium text-red-500">接続できませんでした</p>
          <p className="mt-1 text-sm text-zinc-400">{error}</p>
          <button
            onClick={() => location.reload()}
            className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50"
          >
            再読み込み
          </button>
        </div>
      ) : loading ? (
        <p className="py-16 text-center text-zinc-400">読み込み中…</p>
      ) : members.length === 0 ? (
        <p className="py-16 text-center text-zinc-400">メンバーがいません</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <MemberCard key={m.id} m={m} onAssign={assignTask} canManage={canManage} onSetRole={setRole} />
          ))}
        </div>
      )}
    </div>
  )
}

function MemberCard({ m, onAssign, canManage, onSetRole }) {
  const blocked = m.blocked.length > 0
  const [text, setText] = useState('')
  const submit = async () => {
    if (!text.trim()) return
    await onAssign(m.id, text)
    setText('')
  }
  // オーナー以外は owner/admin が「管理者⇄メンバー」を切り替えられる
  const editable = canManage && m.role !== 'owner'
  return (
    <div className="rounded-2xl border border-zinc-200 p-5">
      {/* ヘッダ */}
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
          style={{ backgroundColor: m.color }}
        >
          {(m.name || '?').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{m.name}</p>
          {editable ? (
            <select
              value={m.role}
              onChange={(e) => onSetRole(m.id, e.target.value)}
              className="mt-0.5 rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-xs text-zinc-600 outline-none focus:border-zinc-400"
            >
              <option value="admin">管理者</option>
              <option value="member">メンバー</option>
            </select>
          ) : (
            <p className="text-xs text-zinc-400">{ROLE_LABEL[m.role] ?? m.role}</p>
          )}
        </div>
      </div>

      {/* 今やっていること */}
      <div className="mt-4">
        <p className="text-xs text-zinc-400">今やっていること</p>
        <p className="mt-0.5 truncate text-sm font-medium text-zinc-700">
          {m.current ?? '—'}
        </p>
      </div>

      {/* 進捗バー */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-400">進捗</span>
          <span className="font-semibold text-zinc-600">{m.progress}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${m.progress}%` }}
          />
        </div>
      </div>

      {/* 状態 */}
      <div className="mt-3 flex items-center gap-3 text-xs">
        <span className="text-zinc-500">
          完了 {m.done}/{m.total}
        </span>
        <span
          className={cn(
            'flex items-center gap-1',
            blocked ? 'font-semibold text-red-500' : 'text-zinc-400',
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          blocked {m.blocked.length}
        </span>
      </div>

      {/* 最終活動 */}
      <div className="mt-3 flex items-start gap-1.5 border-t border-zinc-100 pt-3 text-xs text-zinc-400">
        <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{m.lastActivity ?? 'まだ活動がありません'}</span>
      </div>

      {/* タスクを振る */}
      <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="タスクを振る…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm outline-none focus:border-zinc-400"
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40"
        >
          振る
        </button>
      </div>
    </div>
  )
}
