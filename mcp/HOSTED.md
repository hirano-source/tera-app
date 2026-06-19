# ルートB：ホスト版MCP（URL貼付カスタムコネクター）

本家Addness（`https://vt.api.addness.com/mcp`）と同じ形 —— **Claudeに1本のURLを貼るだけ**で、
ゴール・タスク・活動記録を「話すだけ」で読み書きできるようにする。各メンバーが自分のTERA
資格情報でログインし、**そのユーザーとしてRLSの範囲で**操作する（マルチユーザー）。

ローカル版（ルートA / `mcp/server.js`）との違いは「どこで動くか・誰として動くか」だけ。
9ツール＋`plan_goal`プロンプトの中身は同一。

```
Claude(コネクターにURL貼付)
   └─ GET /mcp ─→ 401 + WWW-Authenticate(resource_metadata)
   └─ /.well-known/oauth-protected-resource ─→ 認可サーバー発見
   └─ /.well-known/oauth-authorization-server ─→ PKCE/DCR を宣言
   └─ /register (DCR) ─→ client_id を動的発行
   └─ /authorize ─→ 302 ─→ 本体(GitHub Pages) #/connect でログイン＆「許可」
                         └─ POST /authorize/complete(refresh_token) ─→ 認可コード
   └─ /token (PKCE検証) ─→ Bearerトークン
   └─ POST /mcp (Bearer) ─→ 9ツール＋plan_goal
```

> ⚠️ **HTMLの制約**：無料の `supabase.co` ドメインは関数の `text/html` を `text/plain` に
> 書き換える。そのためログインUIは関数に置けず、`/authorize` は本体（GitHub Pages）の
> `#/connect`（[MCPConnectPage.jsx](../src/components/auth/MCPConnectPage.jsx)）へ 302 リダイレクトする。
>
> **関数シークレット（設定済み）**：
> - `MCP_PUBLIC_URL` = 公開MCP URL（内部hostが `edge-runtime.supabase.com` になる問題の回避に必須）
> - `MCP_FRONTEND_URL` = `https://hirano-source.github.io/tera-app`
> 再設定例: `SUPABASE_ACCESS_TOKEN=<PAT> npx supabase secrets set KEY=VALUE --project-ref rjxfleeyntqusuoqzclw`

公開URL（デプロイ後）:
`https://rjxfleeyntqusuoqzclw.supabase.co/functions/v1/mcp`

---

## 構成ファイル

| ファイル | 役割 |
|---|---|
| `db/mcp_oauth.sql` | OAuthのclients/codes/tokens表（service_role運用・RLSで一般遮断） |
| `supabase/config.toml` | `[functions.mcp] verify_jwt=false`（公開エンドポイント成立に必須） |
| `supabase/functions/mcp/index.ts` | 司令塔（OAuthとMCPを振り分け） |
| `supabase/functions/mcp/oauth.ts` | 発見 / DCR / 認可 / トークン |
| `supabase/functions/mcp/mcp.ts` | MCP JSON-RPC＋9ツール＋plan_goal |
| `supabase/functions/mcp/supa.ts` | データ層（ユーザー毎クライアント・RLS） |
| `supabase/functions/mcp/store.ts` | OAuth表の保存/引き換え/破棄（service_role） |
| `supabase/functions/mcp/html.ts` | ログイン画面 |

関数には Supabase が `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
を自動注入する。**追加のシークレット設定は不要**。

---

## デプロイ手順（人間が実行 ── 掟 第3条）

> ⚠️ Claudeは勝手にデプロイしない。下記はあなたが叩くコマンド。

```bash
# 0) Supabase CLI（未導入なら）
#    npx で使うのでグローバル導入は任意

# 1) ログイン & プロジェクト紐付け
npx supabase login
npx supabase link --project-ref rjxfleeyntqusuoqzclw

# 2) OAuth用テーブルを作成（Supabase ダッシュボードの SQL Editor に
#    db/mcp_oauth.sql を貼って実行でも可）
#    CLIで流すなら:
#    npx supabase db push   ← migrations運用にしている場合のみ

# 3) 関数をデプロイ（config.toml の verify_jwt=false が効く）
npx supabase functions deploy mcp

# 4) 動作確認（401 + WWW-Authenticate が返ればOK）
curl -i https://rjxfleeyntqusuoqzclw.supabase.co/functions/v1/mcp
# 発見ドキュメント
curl -s https://rjxfleeyntqusuoqzclw.supabase.co/functions/v1/mcp/.well-known/oauth-authorization-server | jq
```

---

## Claudeに接続する

1. Claude（claude.ai / デスクトップ）→ 設定 → コネクター → **カスタムコネクターを追加**
2. URL に貼る:
   `https://rjxfleeyntqusuoqzclw.supabase.co/functions/v1/mcp`
3. 認可画面（TERAログイン）が出る → 自分のメール/パスワードでログイン
4. 接続後、「**おはよう、仕事しよう**」で `get_context` → `list_tasks` が動く

---

## トラブルシュート

- **コネクター追加でOAuth発見に失敗する**
  一部クライアントは認可サーバーのメタデータをルート直下
  (`https://<host>/.well-known/oauth-authorization-server`) に探しにいく。
  Supabase関数は `/functions/v1/mcp` 配下のため、クライアントがルート探索しか
  しない場合はヒットしない。対策：
  - Supabaseの **カスタムドメイン** を関数に割り当て、`/mcp` をルートに寄せる、または
  - リバースプロキシ/Cloudflareで `https://mcp.example.com/*` → 関数 にリライト。
  まずは現行URLで試し、ダメなら上記へ。

- **401が返り続ける** → トークン失効（リフレッシュ回転）。Claude側でコネクターを
  再認可（ログインし直し）。`oauth_tokens` の該当行が古い種を持つ場合がある。

- **ツールが空配列ばかり** → そのユーザーが対象workspaceのmembershipを持つか確認
  （RLSで弾かれている）。`get_context` の workspace が null なら未所属。

- **掃除** → `select purge_expired_oauth();` で期限切れコード/トークンを削除。

---

## セキュリティ覚書

- アクセストークンはランダムな不透明文字列。`oauth_tokens` に保存され、`/mcp` 毎に
  ユーザーのSupabaseセッションへ橋渡しする。一般ユーザーからは見えない（RLS全遮断）。
- 認可コードは5分・1回限り（取得即削除）＋PKCE(S256)必須＝横取り耐性。
- リフレッシュトークンは利用毎に回転し、最新の種で上書きする。
- `verify_jwt=false` は OAuth/MCP を関数内で自前に認可するため。
  service_role キーはサーバー側（関数の環境）にのみ存在し、クライアントには出さない。
