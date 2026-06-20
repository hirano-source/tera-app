import { useEffect } from 'react'

// 新しい版がデプロイされたら自動で読み込み直す（ホーム追加のWebアプリは手動更新できないため）。
// 仕組み：今読み込んでいるメインJS(ハッシュ付き)と、サーバー最新のindex.htmlが指すJSを比較し、
// 違えば location.reload()。ハッシュはデプロイごとに変わるので新版を確実に検知できる。
export function useAutoUpdate() {
  useEffect(() => {
    const currentSrc = [...document.querySelectorAll('script[src]')]
      .map((s) => s.getAttribute('src') || '')
      .find((s) => /assets\/index-.*\.js/.test(s))
    if (!currentSrc) return

    const check = async () => {
      if (document.hidden) return
      try {
        const html = await fetch(`${import.meta.env.BASE_URL}index.html?_=${Date.now()}`, {
          cache: 'no-store',
        }).then((r) => r.text())
        const m = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/)
        if (m && !currentSrc.includes(m[0])) window.location.reload()
      } catch {
        /* オフライン等は無視 */
      }
    }

    check()
    window.addEventListener('focus', check)
    document.addEventListener('visibilitychange', check)
    // 省エネ：頻繁なポーリングはせず10分ごと＋「戻ってきた時」に新版チェック
    const iv = setInterval(check, 600000)
    return () => {
      window.removeEventListener('focus', check)
      document.removeEventListener('visibilitychange', check)
      clearInterval(iv)
    }
  }, [])
}
