// 通知のモックデータ。UI層はフィルタ済みの結果だけを受け取る。
export function useNotifications() {
  return {
    notifications: [],
    filters: ['未読', 'すべて'],
  }
}
