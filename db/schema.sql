-- ============================================================
-- 事業管理アプリ（Addnessクローン）マルチテナント スキーマ
-- 対象: Supabase / PostgreSQL
-- 設計: P1詳細設計.md を参照
-- 使い方: Supabaseの SQL Editor に貼って実行（順序はこのまま）
-- ============================================================

-- 列挙型 -----------------------------------------------------
create type role        as enum ('owner','admin','member');
create type task_status as enum ('todo','doing','done','blocked');
create type goal_status as enum ('active','done','archived');
create type task_source as enum ('goal','calendar','manual');

-- ユーザー（Supabase auth.users と1:1。表示用情報のみ保持）---
create table users (
  id           uuid primary key,            -- = auth.users.id
  name         text not null,
  email        text not null,
  avatar_color text default '#6d5dfc',
  created_at   timestamptz default now()
);

-- ワークスペース（テラ / スキルスリー …）--------------------
create table workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz default now()
);

-- 所属＋ロール ----------------------------------------------
create table memberships (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references users(id)      on delete cascade,
  role         role not null default 'member',
  created_at   timestamptz default now(),
  unique (workspace_id, user_id)
);
create index on memberships (user_id);

-- ゴール（7年→1年→月→… の階層）----------------------------
create table goals (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  owner_id     uuid references users(id),
  parent_id    uuid references goals(id) on delete cascade,
  title        text not null,
  horizon      text,                          -- '5y','1y','month' など
  current      text default '',               -- 現状
  criteria     text default '',               -- 完了の基準
  progress     int  default 0 check (progress between 0 and 100),
  due_date     date,
  status       goal_status default 'active',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index on goals (workspace_id);
create index on goals (parent_id);

-- タスク（誰が何を・状態）-----------------------------------
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  goal_id      uuid references goals(id) on delete set null,
  assignee_id  uuid references users(id),
  title        text not null,
  status       task_status default 'todo',
  for_date     date,
  is_today     boolean default false,
  source       task_source default 'manual',
  due_date     date,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index on tasks (workspace_id);
create index on tasks (assignee_id);
create index on tasks (goal_id);

-- 活動記録（誰が・いつ・何をした）---------------------------
create table activities (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_id     uuid references users(id),
  ts           timestamptz default now(),
  type         text not null,                 -- task_completed, goal_updated, note...
  goal_id      uuid references goals(id) on delete set null,
  task_id      uuid references tasks(id) on delete set null,
  summary      text not null
);
create index on activities (workspace_id, ts desc);

-- コメント（経緯・詰まり）-----------------------------------
create table comments (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  target_type  text not null,                 -- 'goal' | 'task'
  target_id    uuid not null,
  author_id    uuid references users(id),
  body         text not null,
  created_at   timestamptz default now()
);
create index on comments (workspace_id, target_type, target_id);

-- 通知 ------------------------------------------------------
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references users(id),       -- 受信者
  type         text not null,
  payload      jsonb,
  read         boolean default false,
  created_at   timestamptz default now()
);
create index on notifications (user_id, read);

-- カレンダー連携（iCal URL）---------------------------------
create table calendar_sources (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id      uuid not null references users(id),
  ical_url     text not null,
  created_at   timestamptz default now()
);

-- ============================================================
-- 行レベルセキュリティ（テナント分離）
-- 「そのworkspaceにmembershipがある人」だけが行を見られる
-- ============================================================
-- SECURITY DEFINER: 関数内の memberships アクセスはRLSを迂回し、
-- memberships ポリシーからの無限再帰を防ぐ（Supabase RLSの定石）。
create or replace function my_workspace_ids() returns setof uuid
  language sql stable security definer set search_path = public as $$
    select workspace_id from memberships where user_id = auth.uid()
  $$;

do $$
declare t text;
begin
  foreach t in array array[
    'goals','tasks','activities','comments','notifications','calendar_sources'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format($f$
      create policy %1$s_tenant on %1$I
        using (workspace_id in (select my_workspace_ids()))
        with check (workspace_id in (select my_workspace_ids()));
    $f$, t);
  end loop;
end $$;

-- memberships / workspaces 自身のRLS
alter table memberships enable row level security;
create policy memberships_self on memberships
  using (user_id = auth.uid() or workspace_id in (select my_workspace_ids()));

alter table workspaces enable row level security;
create policy workspaces_member on workspaces
  using (id in (select my_workspace_ids()));
