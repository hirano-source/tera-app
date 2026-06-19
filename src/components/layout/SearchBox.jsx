import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Target, CheckSquare } from 'lucide-react'
import { supabase } from '../../utils/supabaseClient'
import { useWorkspace } from '../../hooks/useWorkspace'

// 上部バー中央の検索。現在の事業のゴール／タスクをタイトルで横断検索する。
// クエリは workspace_id=currentId で絞り、RLSも効くので他事業へは漏れない。
export default function SearchBox() {
  const { currentId } = useWorkspace()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState({ goals: [], tasks: [] })
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  // 入力をデバウンスして検索
  useEffect(() => {
    const term = q.trim()
    if (!term || !currentId) {
      setResults({ goals: [], tasks: [] })
      return
    }
    let active = true
    const timer = setTimeout(async () => {
      const like = `%${term}%`
      const [{ data: goals }, { data: tasks }] = await Promise.all([
        supabase.from('goals').select('id,title').eq('workspace_id', currentId).ilike('title', like).limit(6),
        supabase.from('tasks').select('id,title,goal_id,status').eq('workspace_id', currentId).ilike('title', like).limit(6),
      ])
      if (active) setResults({ goals: goals ?? [], tasks: tasks ?? [] })
    }, 200)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [q, currentId])

  // 外側クリックで閉じる
  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const goGoal = (id) => {
    setQ('')
    setOpen(false)
    navigate(`/goals/${id}`)
  }
  const goTask = (t) => {
    setQ('')
    setOpen(false)
    navigate(t.goal_id ? `/goals/${t.goal_id}` : '/todo')
  }

  const hasResults = results.goals.length > 0 || results.tasks.length > 0

  return (
    <div ref={boxRef} className="relative w-full max-w-[640px]">
      <div className="flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-zinc-300 focus-within:bg-white/15">
        <Search className="h-4 w-4 shrink-0" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="ゴール・タスクを検索"
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-400"
        />
      </div>

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-11 z-30 max-h-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-xl">
          {!hasResults && (
            <p className="px-3 py-2 text-sm text-zinc-400">該当なし</p>
          )}
          {results.goals.map((g) => (
            <button
              key={g.id}
              onClick={() => goGoal(g.id)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <Target className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate">{g.title}</span>
              <span className="ml-auto shrink-0 text-xs text-zinc-400">ゴール</span>
            </button>
          ))}
          {results.tasks.map((t) => (
            <button
              key={t.id}
              onClick={() => goTask(t)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            >
              <CheckSquare className="h-4 w-4 shrink-0 text-zinc-400" />
              <span className={`truncate ${t.status === 'done' ? 'text-zinc-400 line-through' : ''}`}>
                {t.title}
              </span>
              <span className="ml-auto shrink-0 text-xs text-zinc-400">タスク</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
