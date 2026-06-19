-- ============================================================
-- メンバー招待（招待コード方式）
-- create_invite: owner/admin が自分のワークスペースの招待コードを発行
-- redeem_invite: ログインユーザーがコードでワークスペースに参加
-- どちらも SECURITY DEFINER（権限チェックは関数内で実施）
-- ============================================================

create table if not exists invites (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  code         text not null unique,
  role         role not null default 'member',
  created_by   uuid references users(id),
  created_at   timestamptz default now(),
  used_at      timestamptz,
  used_by      uuid references users(id)
);
alter table invites enable row level security;
drop policy if exists invites_tenant on invites;
create policy invites_tenant on invites
  using (workspace_id in (select my_workspace_ids()));

-- 招待コード発行（owner/admin のみ）
create or replace function create_invite(p_workspace_id uuid, p_role role default 'member')
returns text language plpgsql security definer set search_path = public as $$
declare v_role role; v_code text;
begin
  select role into v_role from memberships
    where workspace_id = p_workspace_id and user_id = auth.uid();
  if v_role is null or v_role not in ('owner','admin') then
    raise exception 'not authorized';
  end if;
  v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
  insert into invites(workspace_id, code, role, created_by)
    values (p_workspace_id, v_code, p_role, auth.uid());
  return v_code;
end $$;

-- 招待コードで参加
create or replace function redeem_invite(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv invites;
begin
  select * into v_inv from invites where code = upper(p_code) and used_at is null;
  if v_inv.id is null then raise exception 'invalid or used code'; end if;
  insert into memberships(workspace_id, user_id, role)
    values (v_inv.workspace_id, auth.uid(), v_inv.role)
    on conflict (workspace_id, user_id) do nothing;
  update invites set used_at = now(), used_by = auth.uid() where id = v_inv.id;
  return v_inv.workspace_id;
end $$;
