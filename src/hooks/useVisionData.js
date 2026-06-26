import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../utils/supabaseClient'
import { useWorkspace } from './useWorkspace'
import { derivePhase, goalProgress, nextTask } from '../utils/goalView'

// 大目標ダッシュボード用：直下ゴールごとの進捗・タスク・次の一手・レーン、
// 全体進捗、KPI(goal_metrics)、メンバーをまとめて返す。
export function useVisionData(visionId) {
  const { currentId } = useWorkspace()
  const [childGoals, setChildGoals] = useState([])
  const [overall, setOverall] = useState(0)
  const [metrics, setMetrics] = useState([])
  const [members, setMembers] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!currentId || !visionId) return
    const [g, t, mt, mem] = await Promise.all([
      supabase.from('goals').select('*').eq('workspace_id', currentId).order('created_at'),
      supabase.from('tasks').select('id,goal_id,title,status,priority,is_today,due_date,blocker_type,blocker_owner').eq('workspace_id', currentId),
      supabase.from('goal_metrics').select('*').eq('goal_id', visionId).order('sort'),
      supabase.from('users').select('id,name,avatar_color,is_bot'),
    ])
    const goals = g.data ?? []
    const tasks = t.data ?? []
    setMembers(Object.fromEntries((mem.data ?? []).map((u) => [u.id, u])))
    setMetrics(mt.data ?? [])

    const tasksByGoal = {}
    tasks.forEach((ta) => {
      if (ta.goal_id) (tasksByGoal[ta.goal_id] ??= []).push(ta)
    })

    const children = goals
      .filter((go) => go.parent_id === visionId && !go.is_vision)
      .map((go) => {
        const own = tasksByGoal[go.id] ?? []
        const done = own.filter((x) => x.status === 'done').length
        const progress = goalProgress(go, own)
        const blocked = own.find((x) => x.status === 'blocked')
        return {
          id: go.id,
          title: go.title,
          owner_id: go.owner_id,
          progress,
          taskDone: done,
          taskTotal: own.length,
          next: nextTask(own),
          blockedCount: own.filter((x) => x.status === 'blocked').length,
          gateNote: blocked?.blocker_owner ? `${blocked.blocker_owner}待ち` : null,
          phase: go.phase || derivePhase(go, own),
          phaseManual: !!go.phase,
        }
      })

    setChildGoals(children)
    setOverall(children.length ? Math.floor(children.reduce((s, c) => s + c.progress, 0) / children.length) : 0)
    setLoading(false)
  }, [currentId, visionId])

  useEffect(() => {
    load()
  }, [load])

  // KPIの現在値を更新（owner/adminのみRLSで許可）
  const updateMetric = async (metricId, current) => {
    const v = Number(current)
    setMetrics((ms) => ms.map((m) => (m.id === metricId ? { ...m, current: v } : m)))
    const { error } = await supabase.from('goal_metrics').update({ current: v }).eq('id', metricId)
    if (error) {
      alert('保存に失敗しました: ' + error.message)
      load()
    }
  }

  return { childGoals, overall, metrics, members, loading, reload: load, updateMetric }
}
