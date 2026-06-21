-- タスクの粒度（大/中/小/サブ）。時間目安：大≒3ヶ月 / 中≒1週間 / 小≒3日 / サブ≒3時間。
-- 緊急度(priority)とは別軸の「工数の大きさ」。入れ子（parent_task_id）と組み合わせて
-- 大→中→小→サブ とブレイクダウンしていく。enum値は英語、表示は日本語(UI側でマップ)。
do $$ begin
  create type task_size as enum ('big', 'mid', 'small', 'sub');
exception when duplicate_object then null; end $$;

alter table tasks add column if not exists size task_size;
