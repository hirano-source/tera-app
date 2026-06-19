import { Mic } from 'lucide-react'
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition'
import { cn } from '../../utils/cn'

// 音声入力ボタン。クリックで録音→文字起こしし、onText(text) に渡す。
// 非対応ブラウザでは何も表示しない。
export default function MicButton({ onText, className }) {
  const { supported, listening, toggle } = useSpeechRecognition(onText)
  if (!supported) return null
  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? '停止' : '音声入力'}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors',
        listening
          ? 'animate-pulse bg-red-500 text-white'
          : 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600',
        className,
      )}
    >
      <Mic className="h-4 w-4" />
    </button>
  )
}
