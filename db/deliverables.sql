-- ============================================================
-- 成果物（ファイル）: deliverables テーブル + Storage バケット
-- Supabase の SQL Editor に貼って「一度だけ」実行する。
-- これを実行すると、ゴール詳細の「成果物」でファイルの
-- アップロード／ダウンロード／削除が有効になる。
-- ============================================================

-- メタデータ表 ----------------------------------------------
create table if not exists deliverables (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  goal_id      uuid references goals(id) on delete cascade,
  name         text not null,
  storage_path text not null,          -- 形式: <workspace_id>/<goal_id>/<ts>_<filename>
  kind         text,                   -- MIMEタイプ等
  uploaded_by  uuid references users(id),
  created_at   timestamptz default now()
);
create index if not exists deliverables_goal_idx on deliverables (workspace_id, goal_id);

alter table deliverables enable row level security;
create policy deliverables_tenant on deliverables
  using (workspace_id in (select my_workspace_ids()))
  with check (workspace_id in (select my_workspace_ids()));

-- Storage バケット（非公開）---------------------------------
insert into storage.buckets (id, name, public)
  values ('deliverables', 'deliverables', false)
  on conflict (id) do nothing;

-- バケットのRLS: パス先頭フォルダ(=workspace_id)が自分の所属WSのものだけ読み書き
create policy "deliverables_rw" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[1] in (select my_workspace_ids()::text)
  )
  with check (
    bucket_id = 'deliverables'
    and (storage.foldername(name))[1] in (select my_workspace_ids()::text)
  );
