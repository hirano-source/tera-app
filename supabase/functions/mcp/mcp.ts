// MCP プロトコル層（Streamable HTTP / JSON-RPC）。
// ローカル版 mcp/server.js と同じ 9ツール＋plan_goal を、SDKに頼らず手書きで提供する
// （Edge=Deno で軽く確実に動かすため）。ツールの中身は supa.ts に委譲する。
import type { Ctx } from './supa.ts'
import * as supa from './supa.ts'

const PROTOCOL_VERSION = '2025-06-18'

// 接続時にClaudeへ常時渡る「起動トリガー＋基本姿勢」だけの簡潔な使い方ガイド（公式 instructions フィールド）。
// 詳細運用（構造・型・WS安全・現在の状態・このWSの文脈）は get_context の manual に委ねる二段構え。
const INSTRUCTIONS = `あなたはTERA（チームの事業OS）に接続している。接続中は以下を厳守する。

【起動時の挙動（最重要）】
- 会話の冒頭、またはユーザーが「おはよう。仕事しよう」等の仕事開始の合図を送った場合、挨拶だけで返してはいけない。まず get_context を呼び、現在の事業・大目標・今日の状態(manual)を読み込んでから応答する。
- 読み込んだ後、今日やるべき最重要の一手を1〜3個に絞って提示し、最初の一手を促す。

【基本姿勢】記録係で終わらない。
- 放置・blocked のタスクを拾い、具体的な次の一手を出す。
- 大目標から逆算して、足りないゴール／タスクを提案する。
- 会議・相談・決定は add_comment で該当ゴール／タスクに残す。作業前に list_comments で経緯を読む。

詳細な運用ルールは get_context が返す manual に従う。`

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
      parentTaskId: { type: 'string', description: '親タスクのid（指定でサブタスク。ゴール→タスク→タスクの2段まで）' },
      priority: { type: 'string', enum: ['P0', 'P1', 'P2', 'P3', 'P4'], description: 'P0今日中/P1今週中/P2来週中/P3〆切あり/P4いつか' },
      dueDate: { type: 'string', description: '完了期限 YYYY-MM-DD' },
      startDueDate: { type: 'string', description: '着手期限 YYYY-MM-DD' },
      idealState: { type: 'string', description: '理想の状態（終わったらどうなってるか）' },
      currentState: { type: 'string', description: '現状（今どうなってるか）' },
      gap: { type: 'string', description: 'その差（理想と現状のギャップ＝詰まり・足りないもの）' },
      approach: { type: 'string', description: 'やること（差を埋める具体的な一手）' },
      completionCriteria: { type: 'string', description: '完了の基準（できた/できてないの判断＝何ができたら完了か）' },
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
      idealState: { type: 'string', description: '理想の状態' },
      currentState: { type: 'string', description: '現状' },
      gap: { type: 'string', description: 'その差' },
      approach: { type: 'string', description: 'やること' },
      completionCriteria: { type: 'string', description: '完了の基準' },
      recurrence: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
      blockerType: { type: 'string', enum: ['data', 'approval', 'reply', 'external'], description: '詰まりの種類' },
      blockerOwner: { type: 'string', description: '誰待ちか' },
      blockerNote: { type: 'string' },
    },
    required: ['taskId'],
  },
  updateGoal: {
    type: 'object',
    properties: {
      goalId: { type: 'string' },
      title: { type: 'string' },
      idealState: { type: 'string', description: '理想の状態' },
      current: { type: 'string', description: '現状' },
      gap: { type: 'string', description: 'その差' },
      criteria: { type: 'string', description: '完了の基準' },
      dueDate: { type: 'string', description: '期日 YYYY-MM-DD' },
      ownerId: { type: 'string', description: '担当のユーザーid' },
      progress: { type: 'number', description: '進捗 0-100' },
    },
    required: ['goalId'],
  },
  log: { type: 'object', properties: { type: { type: 'string' }, summary: { type: 'string' } }, required: ['type', 'summary'] },
  del: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] },
  delGoal: { type: 'object', properties: { goalId: { type: 'string' } }, required: ['goalId'] },
  comment: {
    type: 'object',
    properties: {
      targetType: { type: 'string', enum: ['goal', 'task'], description: 'コメント先の種類' },
      targetId: { type: 'string', description: 'ゴールまたはタスクのid' },
      body: { type: 'string' },
    },
    required: ['targetType', 'targetId', 'body'],
  },
  listComments: {
    type: 'object',
    properties: {
      targetType: { type: 'string', enum: ['goal', 'task'] },
      targetId: { type: 'string' },
    },
    required: ['targetType', 'targetId'],
  },
} as const

type Tool = { description: string; inputSchema: unknown; run: (ctx: Ctx, args: any) => Promise<unknown> }

const TOOLS: Record<string, Tool> = {
  get_context: {
    description:
      '起動の起点。現在の事業(currentWorkspace)・所属する全事業(workspaces)・大目標・取扱説明と今日の状態(manual)を返す。会話のはじめに必ず呼ぶ。',
    inputSchema: S.empty,
    run: (ctx) => supa.getContext(ctx),
  },
  set_active_workspace: {
    description:
      '操作対象の事業（ワークスペース）を切り替える。以降の操作はこの事業に対して行われる。get_context の workspaces にある id を渡す。',
    inputSchema: {
      type: 'object',
      properties: { workspaceId: { type: 'string', description: '切り替え先の事業id' } },
      required: ['workspaceId'],
    },
    run: async (ctx, a) => {
      const next = await supa.setActiveWorkspace(ctx, a.workspaceId)
      return { currentWorkspace: { id: next.workspaceId, name: next.workspaceName, role: next.role } }
    },
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
    description: 'ゴールを作る。parentId 指定で配下にぶら下げる（階層）。中身は update_goal で埋める。',
    inputSchema: S.createGoal,
    run: (ctx, a) => supa.createGoal(ctx, a),
  },
  update_goal: {
    description: 'ゴールの中身を更新する。理想の状態(idealState)/現状(current)/その差(gap)/完了の基準(criteria)/期日/担当/進捗/タイトル。owner/adminのみ。',
    inputSchema: S.updateGoal,
    run: (ctx, a) => supa.updateGoal(ctx, a),
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
  delete_task: {
    description: 'タスクを削除する（owner/admin、または自分が担当のタスク。権限が無ければ何も起きない）。完了にするだけなら update_task の status=done を使う。',
    inputSchema: S.del,
    run: (ctx, a) => supa.deleteTask(ctx, a),
  },
  delete_goal: {
    description: 'ゴールを削除する（owner/adminのみ）。子ゴール・成果物・チャットも消え、配下タスクは紐づけが外れる。',
    inputSchema: S.delGoal,
    run: (ctx, a) => supa.deleteGoal(ctx, a),
  },
  add_comment: {
    description: 'ゴール/タスクのスレッドにコメントを投稿する（「Claudeより」として確認・提案・議事録を残す）。チームの文脈がそのゴール/タスクに蓄積される。',
    inputSchema: S.comment,
    run: (ctx, a) => supa.addComment(ctx, a),
  },
  list_comments: {
    description: 'ゴール/タスクのコメント（これまでの会話・会議・文脈）を取得する。作業前に読むと経緯が分かる。',
    inputSchema: S.listComments,
    run: (ctx, a) => supa.listComments(ctx, a),
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
