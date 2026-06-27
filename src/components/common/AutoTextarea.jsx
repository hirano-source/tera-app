import { useLayoutEffect, useRef } from 'react'

// 中身の量に合わせて高さが自動で伸びる入力欄。枠内スクロールを無くし、
// 書いた内容がそのまま全部見える（＝スマホで枠内スクロールに指を取られない）。
export default function AutoTextarea({ value, minRows = 2, className, ...props }) {
  const ref = useRef(null)
  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  useLayoutEffect(fit, [value])
  return <textarea ref={ref} rows={minRows} value={value} onInput={fit} className={className} {...props} />
}
