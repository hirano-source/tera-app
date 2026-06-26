-- ============================================================
-- 大目標を「複数」持てるようにする（設計の更新）。
-- これまで：事業ごとに workspaces.vision_goal_id（大目標は1つだけ）。
-- これから：goals.is_vision フラグで大目標を表す＝大目標は何個でもOK。
--   大目標     = is_vision = true かつ parent_id = null（それぞれが独立した頂点）
--   ふだんのゴール = いずれかの大目標の配下（parent_id でぶら下げる）
-- workspaces.vision_goal_id は「主大目標（ゴール追加時の既定の置き場・MCP互換）」
-- として残す（列は削除しない＝既存処理を壊さない）。
-- 冪等：再実行しても安全。対象: Supabase / PostgreSQL（SQL Editor で実行）。
-- ============================================================

-- 1) フラグ列を追加（既定 false）
alter table goals add column if not exists is_vision boolean not null default false;

-- 2) 既存データ移行：今の単一大目標（vision_goal_id）を is_vision=true にする
update goals g
set is_vision = true
from workspaces w
where g.id = w.vision_goal_id
  and g.is_vision = false;

-- 3) 大目標は頂点（親なし）であることを保証：万一 parent_id が付いていたら外す
update goals
set parent_id = null
where is_vision = true
  and parent_id is not null;

-- 4) 事業ごとに大目標を引きやすくする部分インデックス
create index if not exists goals_vision_idx on goals (workspace_id) where is_vision;
