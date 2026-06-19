-- ============================================================
-- 事業内の権限モデル「中間」：
--   ゴール = owner/admin のみ 作成・編集・削除（member は閲覧のみ）
--   タスク = member も 作成・編集・完了OK、削除だけ owner/admin
-- 既存の goals_tenant / tasks_tenant（全員フラット）を、コマンド別＋役職別に置換。
-- activities/comments/notifications/calendar_sources は従来どおりテナント単位のまま。
-- ============================================================

-- 役職判定（SECURITY DEFINER で memberships のRLS再帰を回避）
create or replace function is_workspace_admin(wid uuid) returns boolean
  language sql stable security definer set search_path = public as $$
    select exists (
      select 1 from memberships
      where workspace_id = wid and user_id = auth.uid() and role in ('owner','admin')
    )
  $$;
grant execute on function is_workspace_admin(uuid) to authenticated;

-- ── goals：閲覧は全員、書き込みは owner/admin のみ ──
drop policy if exists goals_tenant  on goals;
drop policy if exists goals_select  on goals;
drop policy if exists goals_insert  on goals;
drop policy if exists goals_update  on goals;
drop policy if exists goals_delete  on goals;

create policy goals_select on goals for select
  using (workspace_id in (select my_workspace_ids()));
create policy goals_insert on goals for insert
  with check (is_workspace_admin(workspace_id));
create policy goals_update on goals for update
  using (is_workspace_admin(workspace_id))
  with check (is_workspace_admin(workspace_id));
create policy goals_delete on goals for delete
  using (is_workspace_admin(workspace_id));

-- ── tasks：作成・編集・完了は member もOK、削除だけ owner/admin ──
drop policy if exists tasks_tenant  on tasks;
drop policy if exists tasks_select  on tasks;
drop policy if exists tasks_insert  on tasks;
drop policy if exists tasks_update  on tasks;
drop policy if exists tasks_delete  on tasks;

create policy tasks_select on tasks for select
  using (workspace_id in (select my_workspace_ids()));
create policy tasks_insert on tasks for insert
  with check (workspace_id in (select my_workspace_ids()));
create policy tasks_update on tasks for update
  using (workspace_id in (select my_workspace_ids()))
  with check (workspace_id in (select my_workspace_ids()));
create policy tasks_delete on tasks for delete
  using (is_workspace_admin(workspace_id));

-- ── 役職の変更（メンバー画面から owner/admin が実行）──
-- owner/admin のみ呼べる。owner の役職は不可侵、付与できるのは admin/member のみ。
-- ＝最後のオーナーが消える/自分をロックアウトする事故を構造的に防ぐ。
create or replace function set_member_role(p_workspace_id uuid, p_user_id uuid, p_role role)
returns void language plpgsql security definer set search_path = public as $$
declare v_caller role; v_target role;
begin
  select role into v_caller from memberships
    where workspace_id = p_workspace_id and user_id = auth.uid();
  if v_caller is null or v_caller not in ('owner','admin') then
    raise exception 'not authorized';
  end if;

  select role into v_target from memberships
    where workspace_id = p_workspace_id and user_id = p_user_id;
  if v_target is null then raise exception 'member not found'; end if;
  if v_target = 'owner' then raise exception 'cannot change owner role'; end if;
  if p_role not in ('admin','member') then raise exception 'role must be admin or member'; end if;

  update memberships set role = p_role
    where workspace_id = p_workspace_id and user_id = p_user_id;
end $$;
grant execute on function set_member_role(uuid, uuid, role) to authenticated;
