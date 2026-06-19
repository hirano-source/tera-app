// MCP プロトコル層（Streamable HTTP / JSON-RPC）。
// ローカル版 mcp/server.js と同じ 9ツール＋plan_goal を、SDKに頼らず手書きで提供する
// （Edge=Deno で軽く確実に動かすため）。ツールの中身は supa.ts に委譲する。
import type { Ctx } from './supa.ts'
import * as supa from './supa.ts'

const PROTOCOL_VERSION = '2025-06-18'

// 接続時にClaudeへ常時渡る運用指示（「おはよう、仕事しよう」を起動コマンドにする配線）。
// 理念/メソッドは別途まとめてから追記する想定。ここは操作手順のみ。
const INSTRUCTIONS = `TERA（目標達成型タスク管理）のMCP。コネクターは利用者本人として動作し、権限はサーバ側RLSで保証される。

「おはよう」「仕事しよう」など作業開始の合図を受けたら、まず get_context / list_tasks({todayOnly:true}) / list_goals を呼んで「現在の事業・今日のToDo・ゴール階層」を把握し、今日やるべきことを簡潔に提示すること。

タスクは create_task / update_task、ゴールは create_goal で操作。権限の無い操作はサーバが拒否する。

タスクを作る/更新するときは、ただのタイトルで終わらせず、可能なら次の項目まで一緒に提案して埋めること（これがTERAの肝）：
- priority（P0今日中/P1今週中/P2来週中/P3〆切あり/P4いつか）
- completionCriteria（完了の基準＝「何ができたら完了か」を一文で）
- approach（最初の一歩・やり方を1つ）
- startDueDate（着手期限）/ dueDate（完了期限）
- recurrence（毎日/毎週/毎月のルーティンなら指定。突発・1回限りの重点案件は省略）
- goalId（関連するゴールがあれば紐づける）
詰まったタスクは status=blocked にし、blockerType（data/approval/reply/external）・blockerOwner（誰待ち）・blockerNote を入れる。`

// JSON Schema（MCPのツール入力はJSON Schemaで宣言する。server.jsのzodと同義）
const S = {
  empty: { type: 'object', properties: {} },
  listTasks: { type: 'object', properties: { todayOnly: { type: 'boolean' }, mine: { type: 'boolean' } } },
  activity: { type: 'object', properties: { limit: { type: 'number' } } },
  createGoal: { type: 'object', properties: { title: { type: 'string' }, parentId: { type: 'string' } }, required: ['title'] },
  createTask: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      assigneeId: { type: 'string', description: '担当者のid（未指定なら自分）' },
      isToday: { type: 'boolean', description: '今日のToDoにするか' },
      goalId: { type: 'string', description: '紐づけるゴールのid（任意）' },
      priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'P4'], description: 'P0今日中/P1今週中/P2来週中/P3〆切あり/P4いつか' },
      dueDate: { type: 'string', description: '完了期限 YYYY-MM-DD' },
      startDueDate: { type: 'string', description: '着手期限 YYYY-MM-DD' },
      completionCriteria: { type: 'string', description: '完了の基準（doneの定義）' },
      approach: { type: 'string', description: '最初の一歩・やり方（1つ）' },
      recurrence: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'ルーティンなら指定。重点案件は省略' },
    },
    required: ['title'],
  },
  assign: { type: 'object', properties: { assigneeId: { type: 'string' }, title: { type: 'string' } }, required: ['assigneeId', 'title'] },
  update: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      status: { type: 'string', enum: ['todo', 'doing', 'done', 'blocked'] },
      title: { type: 'string' },
      priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'P4'] },
      dueDate: { type: 'string', description: '完了期限 YYYY-MM-DD' },
      startDueDate: { type: 'string', description: '着手期限 YYYY-MM-DD' },
      completionCriteria: { type: 'string' },
      approach: { type: 'string' },
      recurrence: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
      blockerType: { type: 'string', enum: ['data', 'approval', 'reply', 'external'], description: '詰まりの種類' },
      blockerOwner: { type: 'string', description: '誰待ちか' },
      blockerNote: { type: 'string' },
    },
    required: ['taskId'],
  },
  log: { type: 'object', properties: { type: { type: 'string' }, summary: { type: 'string' } }, required: ['type', 'summary'] },
} as const

type Tool = { description: string; inputSchema: unknown; run: (ctx: Ctx, args: any) => Promise<unknown> }

const TOOLS: Record<string, Tool> = {
  get_context: {
    description: '「おはよう、仕事しよう」の起点。ワークスペースとあなたを返す。',
    inputSchema: S.empty,
    run: (ctx) => supa.getContext(ctx),
  },
  list_goals: {
    description: '現在のワークスペースのゴール（階層・進捗）を一覧する。',
    inputSchema: S.empty,
    run: (ctx) => supa.listGoals(ctx),
  },
  list_tasks: {
    description: 'タスクを一覧する。todayOnly=今日のToDoのみ / mine=自分担当のみ。',
    inputSchema: S.listTasks,
    run: (ctx, a) => supa.listTasks(ctx, a),
  },
  list_members: {
    description: 'チームのメンバーとロールを返す（タスク割当先の確認に）。',
    inputSchema: S.empty,
    run: (ctx) => supa.listMembers(ctx),
  },
  get_activity_log: {
    description: 'チームの活動記録を新しい順に返す。文脈把握用。',
    inputSchema: S.activity,
    run: (ctx, a) => supa.getActivityLog(ctx, a),
  },
  create_goal: {
    description: 'ゴールを作る。parentId 指定で配下にぶら下げる（階層）。',
    inputSchema: S.createGoal,
    run: (ctx, a) => supa.createGoal(ctx, a),
  },
  create_task: {
    description: 'タスクを作る。タイトルだけでなく priority/completionCriteria/approach/期限/recurrence/goalId まで埋めるのが望ましい。assigneeId 未指定なら自分担当。',
    inputSchema: S.createTask,
    run: (ctx, a) => supa.createTask(ctx, a),
  },
  assign_task: {
    description: 'メンバーにタスクを割り当てる（相手の今日のToDoになる）。list_membersのidを使う。',
    inputSchema: S.assign,
    run: async (ctx, a) => {
      const task = await supa.createTask(ctx, { title: a.title, assigneeId: a.assigneeId, isToday: true })
      await supa.logActivity(ctx, { type: 'task_assigned', summary: `タスクを割り当て: ${a.title}` })
      return task
    },
  },
  update_task: {
    description: 'タスクを更新する。状態(todo/doing/done/blocked)・タイトルのほか、priority/完了基準/やり方/期限/recurrence、詰まり時は blockerType/blockerOwner/blockerNote も指定できる。',
    inputSchema: S.update,
    run: (ctx, a) => supa.updateTask(ctx, a),
  },
  log_activity: {
    description: '活動記録を残す（後で文脈として読み戻せる）。',
    inputSchema: S.log,
    run: (ctx, a) => supa.logActivity(ctx, a),
  },
}

// プロンプト：ゴール設定メソッド（葬式→価値観→7年→今日）。server.js と同文。
const PLAN_GOAL_TEXT = (theme?: string) =>
  [
    'あなたはゴール設定コーチです。以下のメソッドで私と対話し、合意できたら create_goal / create_task で保存してください。',
    '1. 葬式で言われたい言葉を引き出す（1つずつ）',
    '2. 価値観に変換（「〜なことは価値のある賛すべきことだ」）',
    '3. 7年後の数値目標に伸ばす（私が「行けそう」と直感で思えるライン）',
    '4. 7年→1年→今月→今日へブレイクダウン（create_goalはparentIdで階層化、今日分はcreate_task）',
    '5. 逆算できなければ順算＝今取りうる最善の1手を1つだけ出す',
    theme ? `テーマ: ${theme}` : 'まず「葬式で言われたい言葉」を私に問いかけてください。',
  ].join('\n')

type Rpc = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: any }
const ok = (id: Rpc['id'], result: unknown) => ({ jsonrpc: '2.0', id, result })
const err = (id: Rpc['id'], code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } })

// 1件のJSON-RPCリクエストを処理する。notification（id無し）には null を返す＝応答不要。
export async function handleRpc(msg: Rpc, ctx: Ctx): Promise<object | null> {
  const { method, id } = msg
  switch (method) {
    case 'initialize':
      return ok(id, {
        protocolVersion: msg.params?.protocolVersion ?? PROTOCOL_VERSION,
        capabilities: { tools: {}, prompts: {} },
        serverInfo: { name: 'tera', version: '0.2.0' },
        instructions: INSTRUCTIONS,
      })
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null // 通知：応答しない
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, {
        tools: Object.entries(TOOLS).map(([name, t]) => ({
          name, description: t.description, inputSchema: t.inputSchema,
        })),
      })
    case 'tools/call': {
      const tool = TOOLS[msg.params?.name]
      if (!tool) return err(id, -32602, `未知のツール: ${msg.params?.name}`)
      try {
        const data = await tool.run(ctx, msg.params?.arguments ?? {})
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] })
      } catch (e) {
        return ok(id, { content: [{ type: 'text', text: `エラー: ${(e as Error).message}` }], isError: true })
      }
    }
    case 'prompts/list':
      return ok(id, {
        prompts: [{
          name: 'plan_goal',
          description: 'メソッドに沿って対話し、create_goal / create_task で保存する。',
          arguments: [{ name: 'theme', description: 'ゴールのテーマ（任意）', required: false }],
        }],
      })
    case 'prompts/get': {
      if (msg.params?.name !== 'plan_goal') return err(id, -32602, '未知のプロンプト')
      return ok(id, {
        description: 'ゴール設定（葬式→価値観→7年→今日）',
        messages: [{ role: 'user', content: { type: 'text', text: PLAN_GOAL_TEXT(msg.params?.arguments?.theme) } }],
      })
    }
    default:
      return err(id, -32601, `未対応のメソッド: ${method}`)
  }
}
