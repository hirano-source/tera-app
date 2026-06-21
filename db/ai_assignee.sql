-- 担当に「AI（ボット）」を割り当てられるようにする。
-- users は本来 auth.users と1:1だが、FKは users 参照なので auth 無しの表示専用ユーザーを置ける。
-- is_bot=true のメンバーを各ワークスペースに所属させ、担当ピッカーに人と並べて出す（UIは🤖表示）。
alter table users add column if not exists is_bot boolean default false;

-- AI 担当ユーザー（固定ID・ログイン不可）
insert into users (id, name, email, avatar_color, is_bot)
values ('00000000-0000-0000-0000-0000000000a1', 'AI', 'ai@tera.local', '#10b981', true)
on conflict (id) do update set is_bot = true, name = excluded.name, avatar_color = excluded.avatar_color;

-- 既存の全ワークスペースに AI をメンバーとして所属させる（新規WSは作成時に別途追加が必要）
insert into memberships (workspace_id, user_id, role)
select id, '00000000-0000-0000-0000-0000000000a1', 'member' from workspaces
on conflict (workspace_id, user_id) do nothing;
