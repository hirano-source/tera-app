import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useAuth } from './useAuth'

// 所属ワークスペース一覧と「現在のワークスペース」を全体に供給する。
// 複数所属時（招待で参加した場合）も、currentId でデータを1つに絞れる。
const WorkspaceContext = createContext(null)

export function WorkspaceProvider({ children }) {
  const { user } = useAuth()
  const [workspaces, setWorkspaces] = useState([])
  const [currentId, setCurrentId] = useState(() => localStorage.getItem('ws') || null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user?.id) return
    const { data: mems } = await supabase
      .from('memberships')
      .select('role, workspaces(id,name,vision_goal_id)')
      .eq('user_id', user.id)
    const list = (mems ?? [])
      .filter((m) => m.workspaces)
      .map((m) => ({
        id: m.workspaces.id,
        name: m.workspaces.name,
        visionGoalId: m.workspaces.vision_goal_id,
        role: m.role,
      }))
    setWorkspaces(list)
    setCurrentId((prev) =>
      prev && list.some((w) => w.id === prev) ? prev : (list[0]?.id ?? null),
    )
    const { data: me } = await supabase
      .from('users')
      .select('id,name,avatar_color')
      .eq('id', user.id)
      .maybeSingle()
    setProfile(me)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    reload()
  }, [reload])

  const setCurrent = (id) => {
    setCurrentId(id)
    localStorage.setItem('ws', id)
  }

  // 新しい事業（ワークスペース）を作り、その事業に切り替える。
  const createBusiness = async (name) => {
    const { data: id, error } = await supabase.rpc('create_business', { p_name: name })
    if (error) throw error
    await reload()
    setCurrent(id)
    return id
  }

  // 事業（ワークスペース）を削除する。owner限定・最後の1事業は不可（RPC側で保証）。
  // 子データは on delete cascade で一緒に消える。現在の事業を消したら別へ切替。
  const deleteBusiness = async (id) => {
    const { error } = await supabase.rpc('delete_business', { p_workspace_id: id })
    if (error) throw error
    if (currentId === id) localStorage.removeItem('ws')
    await reload()
  }

  // 事業名の変更（owner/adminのみ・RPC）
  const renameBusiness = async (id, name) => {
    const { error } = await supabase.rpc('rename_business', { p_workspace_id: id, p_name: name.trim() })
    if (error) throw error
    await reload()
  }

  // 事業の大目標（vision）を設定/解除（owner/adminのみ・RPC）
  const setVisionGoal = async (id, goalId) => {
    const { error } = await supabase.rpc('set_vision_goal', { p_workspace_id: id, p_goal_id: goalId })
    if (error) throw error
    await reload()
  }

  const current = workspaces.find((w) => w.id === currentId) ?? null
  const display = profile ?? { name: user?.email ?? '', avatar_color: '#6d5dfc' }

  const value = {
    workspaces,
    current,
    currentId,
    setCurrent,
    createBusiness,
    deleteBusiness,
    renameBusiness,
    setVisionGoal,
    reload,
    user: {
      id: profile?.id,
      name: display.name,
      initial: (display.name || '?').charAt(0).toUpperCase(),
      color: display.avatar_color || '#6d5dfc',
    },
    loading,
  }
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  return useContext(WorkspaceContext)
}
