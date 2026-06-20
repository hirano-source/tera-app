-- ============================================================
-- WS認識＋自己説明MCP：
--  (1) アクティブWSをサーバー側に保存（UIタブとMCPが同じ値を共有）。
--      従来UIの現在WSは localStorage のみ＝サーバー(MCP)から読めず、
--      MCPは memberships の先頭を固定で返していた（誤爆の原因）。
--  (2) WSごとの「魂／文脈」テキスト（アシスタントに渡す）。
-- 対象: Supabase / PostgreSQL（SQL Editor か Management API で実行）
-- ============================================================

-- (1) 現在のアクティブWS（UIタブ切替・MCPの set_active_workspace が書き、双方が読む単一の真実）
alter table users add column if not exists active_workspace_id uuid references workspaces(id) on delete set null;

-- (2) WSごとの「魂／文脈」＝アシスタントに渡す自由テキスト（本質シート要約 等）
alter table workspaces add column if not exists assistant_context text;

-- アクティブWSを設定（所属しているWSのみ許可）
create or replace function set_active_workspace(p_workspace_id uuid)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from memberships
    where workspace_id = p_workspace_id and user_id = auth.uid()
  ) then
    raise exception 'そのワークスペースのメンバーではありません';
  end if;
  update users set active_workspace_id = p_workspace_id where id = auth.uid();
end; $$;
grant execute on function set_active_workspace(uuid) to authenticated;

-- WSの文脈(assistant_context)を保存（owner/adminのみ）
create or replace function set_assistant_context(p_workspace_id uuid, p_text text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_workspace_admin(p_workspace_id) then
    raise exception '権限がありません（オーナー/管理者のみ）';
  end if;
  update workspaces set assistant_context = p_text where id = p_workspace_id;
end; $$;
grant execute on function set_assistant_context(uuid, text) to authenticated;
