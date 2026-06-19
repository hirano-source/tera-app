import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../../utils/navigation'
import { cn } from '../../utils/cn'
import { useAuth } from '../../hooks/useAuth'
import teraSymbol from '../../assets/TERA_Symbol_Nega.png'

// 左サイドバー（ダーク）。ロゴ・ナビアイコン・ユーザーアバターを縦に並べる。
// データは props で受け取り、描画に徹する。
export default function Sidebar({ user, badges }) {
  const { signOut } = useAuth()
  return (
    <nav className="hidden h-full w-[88px] shrink-0 flex-col items-center bg-sidebar py-3 text-white md:flex">
      {/* ロゴ */}
      <div className="mb-5 mt-1 flex h-12 w-full items-center justify-center">
        <img src={teraSymbol} alt="TERA" className="w-12 object-contain" />
      </div>

      {/* ナビ */}
      <div className="flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const count = item.badgeKey ? badges?.[item.badgeKey] ?? 0 : 0
          return (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'group relative flex w-16 flex-col items-center gap-1 rounded-xl py-2 transition-colors',
                isActive ? 'text-white' : 'text-zinc-400 hover:text-white',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                    isActive ? 'bg-white/15' : 'group-hover:bg-white/10',
                  )}
                >
                  <item.icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
                  {count > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white">
                      {count}
                    </span>
                  ) : null}
                </span>
                <span className="text-[11px] leading-none">{item.label}</span>
              </>
            )}
          </NavLink>
          )
        })}
      </div>

      {/* ユーザーアバター */}
      <button
        onClick={() => {
          if (confirm('ログアウトしますか？')) signOut()
        }}
        className="mt-2 flex h-11 w-11 items-center justify-center rounded-xl text-base font-bold text-white"
        style={{ backgroundColor: user.color }}
        title={`${user.name}（クリックでログアウト）`}
      >
        {user.initial}
      </button>
    </nav>
  )
}
