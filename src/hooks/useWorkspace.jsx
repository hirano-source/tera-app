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
      .select('role, workspaces(id,name)')
      .eq('user_id', user.id)
    const list = (mems ?? [])
      .filter((m) => m.workspaces)
      .map((m) => ({ id: m.workspaces.id, name: m.workspaces.name, role: m.role }))
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

  const current = workspaces.find((w) => w.id === currentId) ?? null
  const display = profile ?? { name: user?.email ?? '', avatar_color: '#6d5dfc' }

  const value = {
    workspaces,
    current,
    currentId,
    setCurrent,
    createBusiness,
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
