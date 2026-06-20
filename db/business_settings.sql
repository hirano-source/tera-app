-- 事業設定：大目標(vision)・名前変更
-- 大目標は「最上位ゴール」をworkspaceから参照する形（ゴールの仕組みを流用）
alter table workspaces
  add column if not exists vision_goal_id uuid references goals(id) on delete set null;

-- 事業名の変更（owner/adminのみ）
create or replace function rename_business(p_workspace_id uuid, p_name text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception '権限がありません（オーナー/管理者のみ）';
  end if;
  update workspaces set name = p_name where id = p_workspace_id;
end; $$;
grant execute on function rename_business(uuid, text) to authenticated;

-- 大目標の設定/解除（owner/adminのみ。p_goal_id=null で解除）
create or replace function set_vision_goal(p_workspace_id uuid, p_goal_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception '権限がありません（オーナー/管理者のみ）';
  end if;
  update workspaces set vision_goal_id = p_goal_id where id = p_workspace_id;
end; $$;
grant execute on function set_vision_goal(uuid, uuid) to authenticated;
