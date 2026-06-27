import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '../../utils/cn'

// 折りたたみ式の項目。畳んだ状態はヘッダーに1行プレビュー、開くとその場で編集。
export default function CollapsibleField({ label, value, accent, open, onToggle, children }) {
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
