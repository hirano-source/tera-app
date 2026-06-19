-- ============================================================
-- 新規サインアップ時の自動プロビジョニング
-- auth.users に行が入ったら：public.users / workspace / membership /
-- デモのゴール階層・今日のタスク・活動記録を自動生成する。
-- SECURITY DEFINER でRLSを越えて初期データを作る。
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  wid uuid; g5 uuid; g1 uuid; gm uuid;
begin
  insert into public.users (id, name, email)
    values (new.id,
            coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
            new.email);

  insert into public.workspaces (name) values ('マイワークスペース') returning id into wid;
  insert into public.memberships (workspace_id, user_id, role) values (wid, new.id, 'owner');

  insert into public.goals (workspace_id, owner_id, title, horizon, criteria, progress)
    values (wid, new.id, '5年後年商10億', '5y', '年商10億円を達成し組織で回る', 10)
    returning id into g5;
  insert into public.goals (workspace_id, owner_id, parent_id, title, horizon, criteria, progress)
    values (wid, new.id, g5, '年商1億円を達成する', '1y', '月商830万を安定', 30)
    returning id into g1;
  insert into public.goals (workspace_id, owner_id, parent_id, title, horizon, criteria, progress)
    values (wid, new.id, g1, '今月、新規事業の型を1つ作り切る', 'month', '提案資料が商談で使える', 60)
    returning id into gm;

  insert into public.tasks (workspace_id, goal_id, assignee_id, title, is_today, for_date, source)
    values (wid, gm, new.id, '提案資料のたたき台を作る', true, current_date, 'goal'),
           (wid, gm, new.id, '競合の提案事例を3つ調べる', true, current_date, 'goal');

  insert into public.activities (workspace_id, actor_id, type, goal_id, summary)
    values (wid, new.id, 'goal_updated', gm, '今月の目標を設定しました');

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- public.users のRLS：自分＋同じワークスペースの仲間だけ読める
alter table public.users enable row level security;
drop policy if exists users_self_or_teammate on public.users;
create policy users_self_or_teammate on public.users
  using (
    id = auth.uid()
    or id in (select user_id from memberships where workspace_id in (select my_workspace_ids()))
  );
