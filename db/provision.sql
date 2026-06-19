-- ============================================================
-- 新規サインアップ時の自動プロビジョニング
-- auth.users に行が入ったら：public.users / workspace / membership を作る。
-- ゴール・タスク等の中身は作らない（空の器。本人 or Claude/MCP が埋める）。
-- SECURITY DEFINER でRLSを越えて初期データを作る。
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  wid uuid;
begin
  insert into public.users (id, name, email)
    values (new.id,
            coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
            new.email);

  insert into public.workspaces (name) values ('マイ事業') returning id into wid;
  insert into public.memberships (workspace_id, user_id, role) values (wid, new.id, 'owner');

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
