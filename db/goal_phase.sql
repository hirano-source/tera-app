-- ============================================================
-- ゴールの「レーン」（今ここ / 次 / あとで）を手動で固定できるようにする。
-- phase = 'now' | 'next' | 'later'。NULL のときはアプリ側で自動導出する
-- （進捗・タスクの優先度・is_today・詰まりから now/next/later を判定）。
-- 冪等：再実行しても安全。対象: Supabase / PostgreSQL（SQL Editor で実行）
-- ============================================================

alter table goals add column if not exists phase text;

-- 値の制約（NULL は許可＝自動導出に任せる）。既存制約があれば作り直さない。
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'goals_phase_chk'
  ) then
    alter table goals add constraint goals_phase_chk
      check (phase is null or phase in ('now', 'next', 'later'));
  end if;
end $$;
