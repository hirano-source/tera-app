-- ============================================================
-- チャット（ゴール紐付けスレッド）
-- 1ゴール = 1スレッド。メッセージをそこに紐づける。
-- ============================================================
create table if not exists messages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  goal_id      uuid references goals(id) on delete cascade,
  author_id    uuid references users(id),
  body         text not null,
  created_at   timestamptz default now()
);
create index if not exists messages_goal_idx on messages (goal_id, created_at);

alter table messages enable row level security;
drop policy if exists messages_tenant on messages;
create policy messages_tenant on messages
  using (workspace_id in (select my_workspace_ids()))
  with check (workspace_id in (select my_workspace_ids()));
