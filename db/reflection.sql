-- ============================================================
-- 「理想の状態 → 現状 → その差 →（手）」の型をゴール/タスクに通す
-- ・ゴール: ideal_state(理想) / gap(差) を追加（current=現状, criteria=完了基準 は既存）
-- ・タスク: ideal_state(理想) / current_state(現状) / gap(差) を追加
--   （approach=やること は既存。completion_criteria はUIから外すが列は残す）
-- Supabase SQL Editor に貼って一度実行。列追加のみ（破壊なし）。
-- ============================================================
alter table goals
  add column if not exists ideal_state text,
  add column if not exists gap text;

alter table tasks
  add column if not exists ideal_state   text,
  add column if not exists current_state text,
  add column if not exists gap           text;
