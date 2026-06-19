import { Routes, Route, Navigate } from 'react-router-dom'
import TodayTodoPage from '../components/todo/TodayTodoPage'
import GoalsListPage from '../components/goals/GoalsListPage'
import GoalDetailPage from '../components/goals/GoalDetailPage'
import ChatPage from '../components/chat/ChatPage'
import NotificationsPage from '../components/notifications/NotificationsPage'
import MembersPage from '../components/members/MembersPage'
import SettingsPage from '../components/settings/SettingsPage'

// 画面の出し分け（ルート定義）のみを担う。ロジックは持たない。
export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/todo" replace />} />
      <Route path="/todo" element={<TodayTodoPage />} />
      <Route path="/goals" element={<GoalsListPage />} />
      <Route path="/goals/:goalId" element={<GoalDetailPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/members" element={<MembersPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/todo" replace />} />
    </Routes>
  )
}
