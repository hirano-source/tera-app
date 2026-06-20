-- ============================================================
-- タスク削除の権限を拡張：メンバーも「自分が主担当(assignee_id)のタスク」は削除できる。
-- owner/admin は従来どおり全タスク削除可。
-- 自分のタスクを消すと、配下サブタスク（parent_task_id … on delete cascade）も一緒に消える。
-- 対象: Supabase / PostgreSQL（SQL Editor か Management API で実行）
-- ============================================================

drop policy if exists tasks_delete on tasks;
create policy tasks_delete on tasks for delete
  using (is_workspace_admin(workspace_id) or assignee_id = auth.uid());
