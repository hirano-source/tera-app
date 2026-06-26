// 入力の文字数上限（UIが崩れないための制限）。
// 大目標は見出しカード、ゴールはツリーの1行に収める想定。
export const VISION_MAX = 50 // 大目標タイトル
export const GOAL_MAX = 40 // ゴールタイトル

// 上限で安全に切り詰める（音声入力などでmaxLengthをすり抜けた分の保険）。
export const clamp = (text, max) => (text ?? '').slice(0, max)
