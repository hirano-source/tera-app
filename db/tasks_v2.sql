-- ============================================================
-- タスク構造の拡張（v2）
-- 方針:
--   ・「理想/現状/なぜ」はゴールが持つ → タスクには持たせない（重複回避）
--   ・タスクは「実行の単位」に絞る（完了基準・やり方・優先度・期限・詰まり）
--   ・承認フローは作らない（スコープ外）
--   ・ストップウォッチ（作業時間計測）も作らない（スコープ外）
-- 適用: Supabase SQL Editor に貼って一度実行。既存 tasks に列追加するだけ（破壊なし）。
--       RLSは行レベルなので既存ポリシー（テナント分離＋permissions）がそのまま効く。
-- ============================================================

-- 優先度（P0=今日中 / P1=今週中 / P2=来週中 / P3=〆切あり / P4=いつか）
do $$ begin
  create type task_priority as enum ('P0','P1','P2','P3','P4');
exception when duplicate_object then null; end $$;

-- 繰り返し（NULL = 重点案件 / それ以外 = ルーティン）
do $$ begin
  create type task_recurrence as enum ('daily','weekly','monthly');
exception when duplicate_object then null; end $$;

alter table tasks
  add column if not exists priority            task_priority not null default 'P2',
  add column if not exists start_due_date      date,             -- 着手期限（due_date=完了期限とは別。先延ばし検知用）
  add column if not exists completion_criteria text,             -- 完了の基準（done の定義）
  add column if not exists approach            text,             -- 最初の一歩 / やり方（1つ）
  add column if not exists recurrence          task_recurrence,  -- NULL=重点案件 / daily|weekly|monthly=ルーティン
  -- ブロッカー（status='blocked' のとき使う）
  add column if not exists blocker_type        text,             -- 'data' | 'approval' | 'reply' | 'external'
  add column if not exists blocker_owner       text,             -- 誰待ちか
  add column if not exists blocker_since       timestamptz,      -- いつから詰まっているか（3日で黄/7日で赤の判定に使う）
  add column if not exists blocker_note        text;

create index if not exists tasks_priority_idx  on tasks (workspace_id, priority);
create index if not exists tasks_start_due_idx on tasks (workspace_id, start_due_date);

-- 既存の task_status（todo / doing / blocked / done）はそのまま。
--   blocked = 部下アプリの「待ち」。承認用の review/rejected は追加しない。
