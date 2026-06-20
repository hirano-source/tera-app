// 文字起こし（STT）プロキシ。音声を受け取り、OpenAI互換の Whisper API に転送して
// テキストを返す。プロバイダはシークレットで切替（OpenAI / Groq など）。
//
// 必要なシークレット（npx supabase secrets set ...）:
//   STT_API_KEY  … 必須。STTプロバイダのAPIキー
//   STT_API_URL  … 任意。OpenAI互換のベースURL。既定 = Groq
//                  （OpenAIなら https://api.openai.com/v1）
//   STT_MODEL    … 任意。既定 = whisper-large-v3（OpenAIなら whisper-1）
//
// 認証: verify_jwt=false（CORS用）だが、本体で Bearer のユーザーJWTを getUser 検証。
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // ── ユーザー認証（ログイン済みの本人だけがキーを使える）──
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: '認証が必要です' }, 401)
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: u, error: uErr } = await sb.auth.getUser()
  if (uErr || !u?.user) return json({ error: '認証に失敗しました' }, 401)

  // ── STT設定 ──
  const apiKey = Deno.env.get('STT_API_KEY')
  if (!apiKey) {
    return json(
      { error: 'STT_API_KEY が未設定です。SupabaseのシークレットにSTTプロバイダのAPIキーを設定してください。' },
      503,
    )
  }
  const baseUrl = Deno.env.get('STT_API_URL') ?? 'https://api.groq.com/openai/v1'
  const model = Deno.env.get('STT_MODEL') ?? 'whisper-large-v3'

  // ── 受け取った音声を転送 ──
  let inForm: FormData
  try {
    inForm = await req.formData()
  } catch {
    return json({ error: 'multipart/form-data の file が必要です' }, 400)
  }
  const file = inForm.get('file')
  if (!(file instanceof File)) return json({ error: 'file が必要です' }, 400)

  const fwd = new FormData()
  fwd.append('file', file, file.name || 'audio.webm')
  fwd.append('model', model)
  fwd.append('language', (inForm.get('language') as string) || 'ja')
  fwd.append('response_format', 'json')

  let r: Response
  try {
    r = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fwd,
    })
  } catch (e) {
    return json({ error: `STTへの接続に失敗: ${(e as Error).message}` }, 502)
  }
  if (!r.ok) {
    const text = await r.text()
    return json({ error: `STT失敗 (${r.status}): ${text.slice(0, 400)}` }, 502)
  }
  const data = await r.json()
  return json({ text: data.text ?? '' })
})
