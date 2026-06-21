-- ============================================================
-- 整合性の根本治療：
--   原則「表示する値は実体から都度導出。不整合はDBで物理的に禁止」。
--   ここはDB側の番人＋ゴースト源（create_businessのフリーテキスト記録）撤去＋掃除。
-- 対象: Supabase / PostgreSQL（SQL Editor か Management API で実行）
-- ============================================================

-- 0) 先に既存の汚れを掃除（制約追加の前に）
delete from tasks where id in (
  '76fc3a60-39d4-46c2-8874-288c00894f66',  -- ああああd
  '0f783a31-fbed-4982-b00d-ce03c3d885b1',  -- gらおじょf
  '13a3c22e-ba91-4edc-9389-fed9da687322'   -- おjだgp
);
-- リネームで陳腐化した「テラユウゴルフ事業部 を作成しました」ログ（実体=現TERAは存命）
delete from activities where id = '81250cb5-90a7-4d5c-8cc4-7a442fe0d5ab';

-- 1) タイトルの空・空白だけを禁止（直接INSERTでもゴミを入れさせない）
alter table goals drop constraint if exists goals_title_nonempty;
alter table goals add  constraint goals_title_nonempty check (length(btrim(title)) > 0);
alter table tasks drop constraint if exists tasks_title_nonempty;
alter table tasks add  constraint tasks_title_nonempty check (length(btrim(title)) > 0);

-- 2) updated_at を更新時に自動で進める（「最近変わった順」を正確にして導出の土台に）
create or replace function fn_touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trg_goals_touch on goals;
create trigger trg_goals_touch before update on goals for each row execute function fn_touch_updated_at();
drop trigger if exists trg_tasks_touch on tasks;
create trigger trg_tasks_touch before update on tasks for each row execute function fn_touch_updated_at();

-- 3) create_business からフリーテキストの活動ログ記録を撤去（ゴースト源を断つ）
create or replace function create_business(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  wid uuid;
  nm  text := nullif(btrim(p_name), '');
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  if nm is null then raise exception 'name required'; end if;
  insert into public.workspaces (name) values (nm) returning id into wid;
  insert into public.memberships (workspace_id, user_id, role) values (wid, auth.uid(), 'owner');
  return wid;
end $$;
grant execute on function create_business(text) to authenticated;
