-- ============================================================
-- コックピット化（フェーズ1〜3）のDB追加
-- ・comments.resolved : コメントの「解決済み」トグル（フェーズ2）
-- ・task_assignees     : タスクの複数担当（フェーズ3）。assignee_id は主担当として残す
-- Supabase SQL Editor に貼って一度実行。既存への列/表追加のみ（破壊なし）。
-- ============================================================

-- コメントの解決済みフラグ
alter table comments
  add column if not exists resolved boolean not null default false;

-- タスクの複数担当（join）。主担当は tasks.assignee_id のまま、追加担当をここに持つ。
create table if not exists task_assignees (
  task_id      uuid not null references tasks(id) on delete cascade,
  user_id      uuid not null references users(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (task_id, user_id)
);
create index if not exists task_assignees_task_idx on task_assignees (task_id);
create index if not exists task_assignees_ws_idx on task_assignees (workspace_id);

alter table task_assignees enable row level security;
create policy task_assignees_tenant on task_assignees
  using (workspace_id in (select my_workspace_ids()))
  with check (workspace_id in (select my_workspace_ids()));
