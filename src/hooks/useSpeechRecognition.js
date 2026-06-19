import { useEffect, useRef, useState } from 'react'

// ブラウザの音声認識（Web Speech API）。日本語で文字起こしし、結果を onResult に渡す。
// 対応ブラウザ（Chrome/Edge/Safari）＋HTTPS or localhost で動作。非対応なら supported=false。
export function useSpeechRecognition(onResult, lang = 'ja-JP') {
  const SR =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  const supported = !!SR

  const [listening, setListening] = useState(false)
  const recRef = useRef(null)
  const cbRef = useRef(onResult)
  cbRef.current = onResult // 常に最新のコールバックを使う

  useEffect(() => {
    if (!supported) return
    const rec = new SR()
    rec.lang = lang
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join('')
      cbRef.current?.(text)
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    return () => {
      try {
        rec.abort()
      } catch {}
    }
  }, [supported, lang])

  const start = () => {
    if (!supported) return
    try {
      recRef.current.start()
      setListening(true)
    } catch {}
  }
  const stop = () => {
    try {
      recRef.current.stop()
    } catch {}
    setListening(false)
  }
  const toggle = () => (listening ? stop() : start())

  return { supported, listening, toggle }
}
