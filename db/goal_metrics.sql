-- ============================================================
-- 大目標のKPI（サブスク人数・年商・月収など「数字そのもの」の現在地/目標）。
-- 大目標は数字が主役なので、現在値を保存して追えるようにする置き場。
-- 大目標(vision goal)に複数の指標をぶら下げる。current は手で更新できる。
-- 冪等：再実行しても安全（列追加 if not exists / シードは on conflict do nothing）。
-- 対象: Supabase / PostgreSQL（SQL Editor で実行）
-- ============================================================

create table if not exists goal_metrics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  goal_id uuid not null references goals(id) on delete cascade,
  sort int not null default 0,
  key text not null,
  label text not null,
  current numeric not null default 0,
  target numeric,
  unit text,                 -- "人" / "円" など
  display_format text,       -- "count" | "yen_oku"(億表記) | "yen_man"(万表記)
  created_at timestamptz not null default now(),
  unique (goal_id, key)
);

alter table goal_metrics enable row level security;

-- 閲覧は事業メンバー全員、追加/更新/削除は owner/admin（既存ヘルパーに準拠）
drop policy if exists goal_metrics_select on goal_metrics;
create policy goal_metrics_select on goal_metrics for select
  using (workspace_id in (select my_workspace_ids()));
drop policy if exists goal_metrics_insert on goal_metrics;
create policy goal_metrics_insert on goal_metrics for insert
  with check (is_workspace_admin(workspace_id));
drop policy if exists goal_metrics_update on goal_metrics;
create policy goal_metrics_update on goal_metrics for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));
drop policy if exists goal_metrics_delete on goal_metrics;
create policy goal_metrics_delete on goal_metrics for delete
  using (is_workspace_admin(workspace_id));

-- 初期シード：ゴルおじ酒場の大目標（vision goal）に3指標。current は 0（PMF前）。
insert into goal_metrics (workspace_id, goal_id, sort, key, label, current, target, unit, display_format)
select g.workspace_id, g.id, v.sort, v.key, v.label, 0, v.target, v.unit, v.fmt
from goals g
cross join (values
  (0, 'subscribers', 'サブスク', 1000,       '人', 'count'),
  (1, 'revenue',     '年商',     200000000,  '円', 'yen_oku'),
  (2, 'income_pp',   '月収/人',  3000000,    '円', 'yen_man')
) as v(sort, key, label, target, unit, fmt)
where g.id = '9a57de73-00aa-47db-91c0-b9b3f1bc41b3'
on conflict (goal_id, key) do nothing;
