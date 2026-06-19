import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '../../utils/navigation'
import { cn } from '../../utils/cn'

// モバイル用の下部タブバー（iOS風）。md未満で表示し、PCでは隠す。
// 端末のホームインジケータ領域（safe-area）ぶんだけ下に余白を足す。
export default function BottomNav() {
  return (
    <nav
      className="flex shrink-0 items-stretch border-t border-white/10 bg-sidebar text-white md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.key}
          to={item.path}
          className={({ isActive }) =>
            cn(
              'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-colors',
              isActive ? 'text-white' : 'text-zinc-400',
            )
          }
        >
          <span className="relative flex h-6 w-6 items-center justify-center">
            <item.icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
            {item.badge ? (
              <span className="absolute -right-2 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
          </span>
          <span className="text-[10px] leading-none">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
