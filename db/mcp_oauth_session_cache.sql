-- ============================================================
-- 移行：接続が「いちいち消える」バグの修正（セッション・キャッシュ方式）。
-- 背景：毎リクエストで Supabase の refresh token を回転させていたため、
--       同時リクエスト（朝の get_context / list_tasks / list_goals 連発など）で
--       refresh token 再利用検知が発火し、セッションが丸ごと失効していた。
-- 対策：Supabaseが署名した生アクセストークン(JWT・約1時間有効)をキャッシュし、
--       有効な間は使い回す。期限切れの時だけ refresh する＝回転頻度が激減し競合が消える。
-- 対象: Supabase / PostgreSQL（SQL Editor に貼って実行）
-- ============================================================

alter table oauth_tokens add column if not exists session_access_token text;
alter table oauth_tokens add column if not exists session_expires_at   timestamptz;
