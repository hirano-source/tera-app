import { useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'

// ゴールを Supabase から取得し、現在のワークスペースに絞る。
// goals: 全ゴール / topGoals: 最上位（parent_id なし）＝「今やるべきゴール」。
export function useGoals() {
  const { currentId, current, user } = useWorkspace()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentId) return
    let active = true
    supabase
      .from('goals')
      .select('*')
      .eq('workspace_id', currentId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!active) return
        setGoals(data ?? [])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [currentId])

  // ゴールを作成（parentId 指定で配下に）。親未指定なら大目標(北極星)の下にぶら下げる＝頂点構造を維持（設計A）。
  const createGoal = async (title, parentId = null) => {
    const text = title.trim()
    if (!text || !currentId) return null
    const parent = parentId ?? current?.visionGoalId ?? null
    const { data } = await supabase
      .from('goals')
      .insert({
        workspace_id: currentId,
        owner_id: user?.id ?? null,
        parent_id: parent,
        title: text,
        progress: 0,
      })
      .select()
      .single()
    if (data) setGoals((gs) => [...gs, data])
    return data
  }

  const topGoals = goals.filter((g) => g.parent_id === null)
  return { goals, topGoals, loading, createGoal }
}

export function useGoal(goalId) {
  const { currentId } = useWorkspace()
  const [goal, setGoal] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!goalId || !currentId) return
    let active = true
    supabase
      .from('goals')
      .select('*')
      .eq('id', goalId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        setGoal(data)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [goalId, currentId])

  // ゴールの項目を保存（現状/完了基準/期日/担当など）。owner/adminのみRLSで許可。
  const saveGoal = async (patch) => {
    if (!goalId) return
    const { data, error } = await supabase
      .from('goals')
      .update(patch)
      .eq('id', goalId)
      .select()
      .maybeSingle()
    if (error) throw error
    if (data) setGoal(data)
    return data
  }

  // ゴールを削除（owner/adminのみRLSで許可）。子ゴール・成果物・チャットはcascade削除、
  // タスクは goal_id が外れる（タスク自体は残る）。
  const deleteGoal = async () => {
    if (!goalId) return
    const { error } = await supabase.from('goals').delete().eq('id', goalId)
    if (error) throw error
  }

  return { goal, loading, saveGoal, deleteGoal }
}
