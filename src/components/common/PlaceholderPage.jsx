// 未実装画面の共通プレースホルダ。アイコンとタイトルを中央に表示する。
export default function PlaceholderPage({ icon: Icon, title }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-zinc-400">
      {Icon ? <Icon className="h-10 w-10" strokeWidth={1.5} /> : null}
      <p className="mt-3 text-lg font-medium">{title}</p>
      <p className="mt-1 text-sm">（このフェーズで実装予定）</p>
    </div>
  )
}
