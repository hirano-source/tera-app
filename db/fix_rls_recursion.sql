-- ============================================================
-- RLS無限再帰の修正
-- my_workspace_ids() が memberships をSELECTし、その際に
-- memberships のRLSが再び同関数を呼ぶ → 無限再帰 → DB詰まり。
-- SECURITY DEFINER にして関数内のmembershipsアクセスはRLSを迂回させる。
-- （CREATE OR REPLACE で既存関数を上書き。ポリシーは変更不要）
-- ============================================================
create or replace function my_workspace_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select workspace_id from memberships where user_id = auth.uid()
$$;
