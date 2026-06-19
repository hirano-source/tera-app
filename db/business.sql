-- ============================================================
-- 事業（ワークスペース）の新規作成
-- workspaces / memberships は RLS で直接 INSERT 不可なので、
-- SECURITY DEFINER の RPC で「空の事業＋作成者をowner」を作る。
-- ゴールやタスクは作らない（本人 or Claude/MCP が後から埋める）。
-- ============================================================
create or replace function create_business(p_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  wid uuid;
  nm  text := nullif(btrim(p_name), '');
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if nm is null then
    raise exception 'name required';
  end if;

  insert into public.workspaces (name) values (nm) returning id into wid;
  insert into public.memberships (workspace_id, user_id, role)
    values (wid, auth.uid(), 'owner');

  insert into public.activities (workspace_id, actor_id, type, summary)
    values (wid, auth.uid(), 'goal_updated', nm || ' を作成しました');

  return wid;
end $$;

grant execute on function create_business(text) to authenticated;
