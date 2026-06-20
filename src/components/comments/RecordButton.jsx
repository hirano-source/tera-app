import { useRef, useState } from 'react'
import { Mic, Square, Loader2 } from 'lucide-react'
import { supabase } from '../../utils/supabaseClient'
import { cn } from '../../utils/cn'

// マイクで録音→Groq(Whisper)で文字起こし→onText(text) で返す。議事録の口述/会議用。
// 押す=録音開始、もう一度押す=停止して文字起こし。
export default function RecordButton({ onText }) {
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        await transcribe(blob)
      }
      mr.start()
      mediaRef.current = mr
      setRecording(true)
    } catch (e) {
      alert('マイクが使えませんでした: ' + (e?.message ?? e))
    }
  }

  const stop = () => {
    mediaRef.current?.stop()
    setRecording(false)
  }

  const transcribe = async (blob) => {
    setBusy(true)
    try {
      const ext = (blob.type || '').includes('mp4') ? 'm4a' : 'webm'
      const form = new FormData()
      form.append('file', blob, `rec.${ext}`)
      form.append('language', 'ja')
      const { data, error } = await supabase.functions.invoke('transcribe', { body: form })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      if (data?.text) onText(data.text)
    } catch (e) {
      alert('文字起こしに失敗しました: ' + (e?.message ?? e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={recording ? stop : start}
      disabled={busy}
      title={recording ? '停止して文字起こし' : '録音して文字起こし（議事録）'}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
        recording
          ? 'animate-pulse border-red-300 bg-red-50 text-red-500'
          : 'border-zinc-300 text-zinc-500 hover:bg-zinc-50',
        busy && 'opacity-60',
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : recording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  )
}
