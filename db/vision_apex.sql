-- ============================================================
-- 設計A：事業の大目標(vision)を「北極星＝ツリーの唯一の頂点」にする。
-- すべてのゴールは大目標の配下に積み上げる。
-- ここでは既存データを頂点構造へ揃える：大目標が設定済みの事業で、
-- 今ある最上位ゴール（parent_id=null）を大目標の下へ付け替える（大目標自身は除く）。
-- 冪等：すでに頂点配下のゴールには影響しない（再実行しても安全）。
-- 対象: Supabase / PostgreSQL（SQL Editor か Management API で実行）
-- ============================================================

update goals g
set parent_id = w.vision_goal_id
from workspaces w
where g.workspace_id = w.id
  and w.vision_goal_id is not null
  and g.parent_id is null
  and g.id <> w.vision_goal_id;
