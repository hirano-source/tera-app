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
      .select('role, workspaces(id,name,vision_goal_id,logo_url,assistant_context)')
      .eq('user_id', user.id)
    const list = (mems ?? [])
      .filter((m) => m.workspaces)
      .map((m) => ({
        id: m.workspaces.id,
        name: m.workspaces.name,
        visionGoalId: m.workspaces.vision_goal_id,
        logoUrl: m.workspaces.logo_url,
        assistantContext: m.workspaces.assistant_context,
        role: m.role,
      }))
    setWorkspaces(list)
    const { data: me } = await supabase
      .from('users')
      .select('id,name,avatar_color,active_workspace_id')
      .eq('id', user.id)
      .maybeSingle()
    setProfile(me)
    // 現在WSはサーバーのアクティブWS（users.active_workspace_id）を正とする
    // ＝端末・Claudeが全部同じ事業に自動で揃う。localStorageは即時描画用キャッシュ、最後に先頭。
    const inList = (id) => id && list.some((w) => w.id === id)
    const chosen = inList(me?.active_workspace_id)
      ? me.active_workspace_id
      : inList(localStorage.getItem('ws'))
        ? localStorage.getItem('ws')
        : list[0]?.id ?? null
    if (chosen) localStorage.setItem('ws', chosen)
    setCurrentId(chosen)
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    reload()
  }, [reload])

  // 即時同期：他端末やClaudeで現在WSが変わっても、アプリに戻った時／定期的に
  // サーバーのアクティブWSを読み直して反映する（更新ボタンを押さなくても揃う）。
  useEffect(() => {
    if (!user?.id) return
    const sync = () => {
      if (!document.hidden) reload()
    }
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', sync)
    const iv = setInterval(sync, 20000)
    return () => {
      window.removeEventListener('focus', sync)
      document.removeEventListener('visibilitychange', sync)
      clearInterval(iv)
    }
  }, [user?.id, reload])

  const setCurrent = (id) => {
    setCurrentId(id)
    localStorage.setItem('ws', id)
    // サーバー側にもアクティブWSを記録＝MCP（Claude連携）が同じ現在WSを読む
    supabase.rpc('set_active_workspace', { p_workspace_id: id }).then(() => {})
  }

  // このWSの「魂／文脈」（アシスタントに渡す自由テキスト）を保存（owner/admin・RPC）
  const setAssistantContext = async (id, text) => {
    const { error } = await supabase.rpc('set_assistant_context', { p_workspace_id: id, p_text: text })
    if (error) throw error
    await reload()
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

  // 事業ロゴをアップロードして設定（公開バケット branding）
  const uploadLogo = async (id, file) => {
    const path = `${id}/logo_${Date.now()}_${file.name}`
    const up = await supabase.storage.from('branding').upload(path, file, { upsert: true })
    if (up.error) throw up.error
    const { data } = supabase.storage.from('branding').getPublicUrl(path)
    const { error } = await supabase.rpc('set_business_logo', { p_workspace_id: id, p_url: data.publicUrl })
    if (error) throw error
    await reload()
  }

  const removeLogo = async (id) => {
    const { error } = await supabase.rpc('set_business_logo', { p_workspace_id: id, p_url: null })
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
    setAssistantContext,
    uploadLogo,
    removeLogo,
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
