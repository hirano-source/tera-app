// チャット（スレッド一覧）のモックデータ。
// タブ: 今日のToDo / ゴール / DM / グループ。
export function useChat() {
  return {
    tabs: [
      { key: 'todo', label: '今日のToDo' },
      { key: 'goals', label: 'ゴール' },
      { key: 'dm', label: 'DM' },
      { key: 'group', label: 'グループ' },
    ],
    threads: [],
  }
}
