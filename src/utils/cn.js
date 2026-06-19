// クラス名を条件付きで結合する純粋関数。
// falsy な値は無視して、スペース区切りで連結する。
export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}
