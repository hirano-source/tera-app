-- ============================================================
-- 事業（ワークスペース）の削除 RPC
-- ・owner のみ実行可
-- ・自分の最後の1事業は消せない（ロックアウト防止）
-- ・子データ（goals/tasks/comments/notifications/messages/invites/
--   deliverables/activities/calendar_sources/memberships）は
--   workspaces への on delete cascade で自動的に一緒に削除される
-- Supabase の SQL Editor に貼って一度だけ実行する。
-- ============================================================
create or replace function delete_business(p_workspace_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  -- 実行者がその事業の owner か（owner以外は拒否）
  if not exists (
    select 1 from memberships
    where workspace_id = p_workspace_id
      and user_id = auth.uid()
      and role = 'owner'
  ) then
    raise exception 'この事業を削除する権限がありません（オーナーのみ）';
  end if;

  -- 自分の最後の1事業は消せない
  if (select count(*) from memberships where user_id = auth.uid()) <= 1 then
    raise exception '最後の事業は削除できません';
  end if;

  delete from workspaces where id = p_workspace_id;
end;
$$;

grant execute on function delete_business(uuid) to authenticated;
