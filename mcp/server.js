// TERA ローカルMCPサーバー（STDIO）。
// Claude が本物のSupabase（チーム共有データ）を「あなた」として読み書きする入口。
// ロジックは supa.js に委譲し、ここはツール定義の組み立てに徹する。
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import * as supa from './supa.js'

const server = new McpServer({ name: 'tera', version: '0.2.0' })

const text = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] })
const fail = (e) => ({ content: [{ type: 'text', text: `エラー: ${e.message}` }], isError: true })
const run = async (fn) => {
  try {
    return text(await fn())
  } catch (e) {
    return fail(e)
  }
}

server.registerTool(
  'get_context',
  {
    title: 'ワークスペース文脈',
    description: '「おはよう、仕事しよう」の起点。ワークスペースとあなたを返す。',
    inputSchema: {},
  },
  () => run(() => supa.getContext()),
)

server.registerTool(
  'list_goals',
  {
    title: 'ゴール一覧',
    description: '現在のワークスペースのゴール（階層・進捗）を一覧する。',
    inputSchema: {},
  },
  () => run(() => supa.listGoals()),
)

server.registerTool(
  'list_tasks',
  {
    title: 'タスク一覧',
    description: 'タスクを一覧する。todayOnly=今日のToDoのみ / mine=自分担当のみ。',
    inputSchema: {
      todayOnly: z.boolean().optional(),
      mine: z.boolean().optional(),
    },
  },
  (args) => run(() => supa.listTasks(args)),
)

server.registerTool(
  'list_members',
  {
    title: 'メンバー一覧',
    description: 'チームのメンバーとロールを返す（タスク割当先の確認に）。',
    inputSchema: {},
  },
  () => run(() => supa.listMembers()),
)

server.registerTool(
  'get_activity_log',
  {
    title: '活動記録',
    description: 'チームの活動記録を新しい順に返す。文脈把握用。',
    inputSchema: { limit: z.number().optional() },
  },
  ({ limit }) => run(() => supa.getActivityLog({ limit })),
)

server.registerTool(
  'create_goal',
  {
    title: 'ゴール作成',
    description: 'ゴールを作る。parentId 指定で配下にぶら下げる（階層）。',
    inputSchema: { title: z.string(), parentId: z.string().optional() },
  },
  ({ title, parentId }) => run(() => supa.createGoal({ title, parentId })),
)

server.registerTool(
  'create_task',
  {
    title: 'タスク作成',
    description: 'タスクを作る。assigneeId 未指定なら自分担当。isToday=今日のToDo。',
    inputSchema: {
      title: z.string(),
      assigneeId: z.string().optional(),
      isToday: z.boolean().optional(),
    },
  },
  (args) => run(() => supa.createTask(args)),
)

server.registerTool(
  'assign_task',
  {
    title: 'タスクを振る',
    description: 'メンバーにタスクを割り当てる（相手の今日のToDoになる）。list_membersのidを使う。',
    inputSchema: { assigneeId: z.string(), title: z.string() },
  },
  ({ assigneeId, title }) =>
    run(async () => {
      const task = await supa.createTask({ title, assigneeId, isToday: true })
      await supa.logActivity({ type: 'task_assigned', summary: `タスクを割り当て: ${title}` })
      return task
    }),
)

server.registerTool(
  'update_task',
  {
    title: 'タスク更新',
    description: 'タスクの状態(todo/doing/done/blocked)やタイトルを更新する。',
    inputSchema: {
      taskId: z.string(),
      status: z.enum(['todo', 'doing', 'done', 'blocked']).optional(),
      title: z.string().optional(),
    },
  },
  (args) => run(() => supa.updateTask(args)),
)

server.registerTool(
  'log_activity',
  {
    title: '活動記録の追加',
    description: '活動記録を残す（後で文脈として読み戻せる）。',
    inputSchema: { type: z.string(), summary: z.string() },
  },
  (args) => run(() => supa.logActivity(args)),
)

// プロンプト：ゴール設定メソッド（葬式→価値観→7年→今日）
server.registerPrompt(
  'plan_goal',
  {
    title: 'ゴール設定（葬式→価値観→7年→今日）',
    description: 'メソッドに沿って対話し、create_goal / create_task で保存する。',
    argsSchema: { theme: z.string().optional() },
  },
  ({ theme }) => ({
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: [
            'あなたはゴール設定コーチです。以下のメソッドで私と対話し、合意できたら create_goal / create_task で保存してください。',
            '1. 葬式で言われたい言葉を引き出す（1つずつ）',
            '2. 価値観に変換（「〜なことは価値のある賛すべきことだ」）',
            '3. 7年後の数値目標に伸ばす（私が「行けそう」と直感で思えるライン）',
            '4. 7年→1年→今月→今日へブレイクダウン（create_goalはparentIdで階層化、今日分はcreate_task）',
            '5. 逆算できなければ順算＝今取りうる最善の1手を1つだけ出す',
            theme ? `テーマ: ${theme}` : 'まず「葬式で言われたい言葉」を私に問いかけてください。',
          ].join('\n'),
        },
      },
    ],
  }),
)

const transport = new StdioServerTransport()
await server.connect(transport)
