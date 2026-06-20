// 要約（LLM）プロキシ。テキストを受け取り、OpenAI互換のChat APIで議事録に整形して返す。
// 文字起こし(transcribe)と同じ Groq キーで動く（無料枠）。
//
// シークレット:
//   STT_API_KEY   … 必須（transcribeと共用＝Groqのキー）
//   STT_API_URL   … 任意。既定 = Groq（OpenAI互換ベースURL）
//   SUMMARY_MODEL … 任意。既定 = llama-3.3-70b-versatile
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}
function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'content-type': 'application/json' } })
}

const SYSTEM = `あなたは会議の議事録作成者です。渡された文字起こし/メモを、簡潔で読みやすい日本語の議事録にまとめてください。
- 相槌・言い直し・冗長な部分は省く
- 「決定事項」「ToDo（担当が分かれば添える）」「論点・保留」を見出しにして箇条書き
- 元に無い情報は足さない。短い入力ならそのまま要点だけ
出力は議事録本文のみ。前置きや「以下が議事録です」等は不要。`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: '認証が必要です' }, 401)
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: u, error: uErr } = await sb.auth.getUser()
  if (uErr || !u?.user) return json({ error: '認証に失敗しました' }, 401)

  const apiKey = Deno.env.get('STT_API_KEY')
  if (!apiKey) return json({ error: 'STT_API_KEY が未設定です。' }, 503)
  const baseUrl = Deno.env.get('STT_API_URL') ?? 'https://api.groq.com/openai/v1'
  const model = Deno.env.get('SUMMARY_MODEL') ?? 'llama-3.3-70b-versatile'

  let body: { text?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'JSON body の text が必要です' }, 400)
  }
  const text = (body.text ?? '').trim()
  if (!text) return json({ error: 'text が空です' }, 400)

  let r: Response
  try {
    r = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: text },
        ],
      }),
    })
  } catch (e) {
    return json({ error: `要約への接続に失敗: ${(e as Error).message}` }, 502)
  }
  if (!r.ok) {
    const t = await r.text()
    return json({ error: `要約失敗 (${r.status}): ${t.slice(0, 400)}` }, 502)
  }
  const data = await r.json()
  const summary = data?.choices?.[0]?.message?.content ?? ''
  return json({ summary })
})
