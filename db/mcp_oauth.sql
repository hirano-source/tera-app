-- ============================================================
-- ルートB（ホスト版MCP）用：OAuth 2.1 サーバーの保管庫
-- 対象: Supabase / PostgreSQL  （SQL Editor に貼って実行）
--
-- これらの表は Edge Function が service_role で読み書きする。
-- 一般ユーザー（anon / authenticated）からは一切見せない＝RLSで全遮断。
-- ============================================================

-- 動的クライアント登録（DCR）で登録された Claude などのクライアント
create table if not exists oauth_clients (
  client_id      text primary key,
  client_name    text,
  redirect_uris  text[] not null default '{}',
  created_at     timestamptz default now()
);

-- 認可コード（/authorize で発行 → /token で1回だけ引き換え）
create table if not exists oauth_codes (
  code           text primary key,
  client_id      text not null,
  redirect_uri   text not null,
  code_challenge text not null,           -- PKCE S256 チャレンジ
  user_id        uuid not null,           -- ログインしたTERAユーザー
  refresh_token  text not null,           -- そのユーザーのSupabaseリフレッシュトークン
  resource       text,                    -- 要求された MCP リソースURL
  expires_at     timestamptz not null,    -- 短命（数分）
  created_at     timestamptz default now()
);

-- アクセストークン（/token で発行 → /mcp で Bearer として提示）
create table if not exists oauth_tokens (
  access_token   text primary key,
  client_id      text not null,
  user_id        uuid not null,
  refresh_token  text not null,           -- ユーザーとして再ログインするための種（回転に追従して更新）
  expires_at     timestamptz not null,
  created_at     timestamptz default now()
);
create index if not exists oauth_tokens_user on oauth_tokens (user_id);

-- ── RLS：一般ユーザーには完全に不可視。service_role はRLSを迂回する ──
alter table oauth_clients enable row level security;
alter table oauth_codes   enable row level security;
alter table oauth_tokens  enable row level security;
-- ポリシーを一切作らない＝anon/authenticated からは行が見えない（service_roleのみ操作可）。

-- ── 期限切れの掃除（任意・定期実行 or 手動） ──
create or replace function purge_expired_oauth() returns void
  language sql security definer set search_path = public as $$
    delete from oauth_codes  where expires_at < now();
    delete from oauth_tokens where expires_at < now();
  $$;
