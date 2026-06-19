# 事業管理アプリ（Addness クローン）

AIアシスタント **"Claude"** を中核に据えた、**目標達成型タスク管理 ＋ チームチャット** のWebアプリ。
個人/チームが「ゴール」を設定し、AIが分解・問い・今日やるべきToDoを提案する。

---

## 設計思想

### 1. 司令塔とパーツの分離
`App.jsx` はアプリの **司令塔** に徹し、ロジックとUIは外部へ完全に切り出す。
App.jsx を読めばアプリ全体の構造が一望できる状態を保つ（目安 388行前後）。
詳細な規律は [`.claudecode.md`](./.claudecode.md)（プロジェクトの掟）を参照。

### 2. ロジック / UI / 純粋関数 の三層分離
- **hooks** … 状態・副作用・業務ロジックの単一の置き場所
- **components** … 「受け取って描くだけ」のUI
- **utils** … 状態を持たない純粋関数

UIからロジックを呼べるが、その逆（ロジックがUIに依存する）は禁止。

### 3. 段階的構築
土台 → ゴール → 今日のToDo → Claude(AI) → チャット → 通知 → ハドル → 仕上げ、の順で
縦に薄く積み上げる。各段階で「触れる」状態を維持する。

---

## ディレクトリ構成

```
.
├── .claudecode.md      # プロジェクトの掟（最上位ルール）
├── 要件定義.md          # 機能要件・実現可能性の判定
├── README.md           # 本ファイル（設計思想）
└── src/
    ├── App.jsx         # 司令塔（オーケストレーター）
    ├── hooks/          # ロジック層（状態・副作用・API）
    ├── components/     # UI層（表示のみ）
    ├── routing/        # 画面遷移・ルート定義
    └── utils/          # 純粋関数（整形・変換・検証）
```

---

## 技術スタック（予定）

| レイヤー | 採用 |
|---|---|
| フロント | React + Vite + TypeScript |
| UI | Tailwind CSS |
| バックエンド/DB/認証/リアルタイム | （未確定 / 機能実装の相談時に決定） |
| AI (Claude) | Anthropic Claude API |

---

## 開発上の約束

- **勝手なデプロイ・外部公開はしない**（掟 第3条）。本番反映は人間の明示指示のみ。
- 機能の実装前に「どのフォルダの責務か」を確認する。
- 仕様や設計に迷ったら `.claudecode.md` に立ち返る。

---

## Claude連携（MCP）— 「話すだけで仕事が終わる」

このアプリの本体価値は、UIだけでなく **Claude のMCPサーバー** として
本物のSupabase（チーム共有データ）を読み書きさせること。`mcp/` にローカルSTDIOサーバーを実装済み。

- **Supabaseデータ層**: [`mcp/supa.js`](./mcp/supa.js)（あなたとしてサインインしRLS内で読み書き）
- **MCPサーバー**: [`mcp/server.js`](./mcp/server.js)（ツール定義の入口）
- **登録設定**: [`.mcp.json`](./.mcp.json)（プロジェクト同梱・自動検出）

公開ツール: `get_context` / `list_goals` / `create_goal` / `list_tasks` / `create_task`
/ `assign_task`（メンバーに振る）/ `update_task` / `list_members` / `get_activity_log` / `log_activity`
＋プロンプト `plan_goal`（葬式→価値観→7年→今日）

### 接続手順（ローカル・デプロイ不要）

1. `.env` にあなたのTERAログインを追加（[.env.example](./.env.example) 参照）:
   ```
   TERA_EMAIL=you@example.com
   TERA_PASSWORD=your-password
   ```
2. Claude Code を再起動（`.mcp.json` で `tera` サーバーが自動検出される）
3. 「**おはよう、仕事しよう**」と話しかけると、Claude がチームの状況・今日のToDoを読んで動く。
   「**山田さんに『議事録まとめ』を振っといて**」で `assign_task` も実行。

```bash
# 動作確認（MCP Inspector）
TERA_EMAIL=… TERA_PASSWORD=… npx @modelcontextprotocol/inspector node mcp/server.js
```

> ホスト型（動画の "URL貼り付けカスタムコネクター"・各メンバーがOAuthで接続）は
> 公開＝デプロイのため、掟 第3条によりユーザーの明示指示があるまで実施しない。

## セットアップ

```bash
npm install
npm run dev   # UI（http://localhost:5173）
```
