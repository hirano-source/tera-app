-- 事業ごとのロゴ（公開URLで表示）
alter table workspaces add column if not exists logo_url text;

-- 公開バケット（ロゴは公開・直URLで表示）
insert into storage.buckets (id, name, public) values ('branding','branding',true)
  on conflict (id) do nothing;

-- 書き込みは自分の所属WSのフォルダ(先頭=workspace_id)だけ・読み取りは公開
create policy "branding_write" on storage.objects for all to authenticated
  using (bucket_id='branding' and (storage.foldername(name))[1] in (select my_workspace_ids()::text))
  with check (bucket_id='branding' and (storage.foldername(name))[1] in (select my_workspace_ids()::text));

-- ロゴURLの設定/解除（owner/adminのみ）
create or replace function set_business_logo(p_workspace_id uuid, p_url text)
  returns void language plpgsql security definer set search_path=public as $$
begin
  if not is_workspace_admin(p_workspace_id) then raise exception '権限がありません（オーナー/管理者のみ）'; end if;
  update workspaces set logo_url = p_url where id = p_workspace_id;
end; $$;
grant execute on function set_business_logo(uuid,text) to authenticated;
