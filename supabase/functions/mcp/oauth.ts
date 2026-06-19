// OAuth 2.1 認可サーバー層（PKCE + 動的クライアント登録 / DCR）。
// 本家Addnessの vt.api.addness.com と同じ「URL貼付カスタムコネクター」を成立させる発見〜認可。
import * as store from './store.ts'
import * as supa from './supa.ts'

// 無料の supabase.co ドメインは関数からの text/html を text/plain に書き換えるため、
// ログインUIは本体（GitHub Pages）に置き、/authorize はそこへ誘導する。
const FRONTEND = (Deno.env.get('MCP_FRONTEND_URL') ?? 'https://hirano-source.github.io/tera-app')
  .replace(/\/$/, '')

const json = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...headers },
  })

// ── 発見ドキュメント ─────────────────────────────────────
// base = この MCP リソースの絶対URL（例: https://<ref>.supabase.co/functions/v1/mcp）
export function protectedResource(base: string) {
  return json({
    resource: base,
    authorization_servers: [base],
    bearer_methods_supported: ['header'],
  })
}

export function authServerMetadata(base: string) {
  return json({
    issuer: base,
    authorization_endpoint: `${base}/authorize`,
    token_endpoint: `${base}/token`,
    registration_endpoint: `${base}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'], // public client（PKCEで保護）
    scopes_supported: ['mcp'],
  })
}

// ── 動的クライアント登録（DCR / RFC 7591） ────────────────
export async function register(req: Request) {
  const body = await req.json().catch(() => ({}))
  const redirectUris: string[] = body.redirect_uris ?? []
  if (!redirectUris.length) return json({ error: 'invalid_redirect_uri' }, 400)
  const c = await store.registerClient(body.client_name ?? 'Claude', redirectUris)
  return json({
    client_id: c.client_id,
    redirect_uris: c.redirect_uris,
    token_endpoint_auth_method: 'none',
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
  }, 201)
}

// ── 認可エンドポイント（GET） ────────────────────────────
// パラメータを検証し、本体（GitHub Pages）の接続画面へ 302 リダイレクトする。
// 実際のログイン＆「許可」は本体側で行い、最後に /authorize/complete を叩く。
export function authorize(req: Request): Response {
  const url = new URL(req.url)
  const p = url.searchParams
  const required = ['client_id', 'redirect_uri', 'code_challenge']
  for (const k of required)
    if (!p.get(k)) return json({ error: 'invalid_request', error_description: `missing ${k}` }, 400)
  if ((p.get('code_challenge_method') ?? 'S256') !== 'S256')
    return json({ error: 'invalid_request', error_description: 'code_challenge_method must be S256' }, 400)

  const q = new URLSearchParams({
    client_id: p.get('client_id')!,
    redirect_uri: p.get('redirect_uri')!,
    code_challenge: p.get('code_challenge')!,
    state: p.get('state') ?? '',
    resource: p.get('resource') ?? '',
  })
  return new Response(null, {
    status: 302,
    headers: { location: `${FRONTEND}/#/connect?${q.toString()}` },
  })
}

// ── 認可コード発行（本体の接続画面から呼ばれる JSON API） ──
// 本体でログイン済みのユーザーが「許可」した時、その refresh_token を受け取り、
// 本人を確認した上で認可コードを発行して Claude へ戻す URL を返す。
export async function authorizeComplete(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const b = await req.json().catch(() => null)
  if (!b || !b.client_id || !b.redirect_uri || !b.code_challenge || !b.refresh_token)
    return json({ error: 'invalid_request' }, 400)

  const client = await store.getClient(b.client_id)
  if (!client || !client.redirect_uris.includes(b.redirect_uri))
    return json({ error: 'invalid_client' }, 400)

  // refresh_token から本人（user_id）を確定。失敗＝未ログイン扱い。
  let ctx
  try {
    ctx = await supa.contextFromRefresh(b.refresh_token)
  } catch {
    return json({ error: 'access_denied', error_description: 'login required' }, 401)
  }

  const code = await store.saveCode({
    client_id: b.client_id,
    redirect_uri: b.redirect_uri,
    code_challenge: b.code_challenge,
    user_id: ctx.userId,
    refresh_token: ctx.refreshToken,
    resource: b.resource,
  })

  const redirect = new URL(b.redirect_uri)
  redirect.searchParams.set('code', code)
  if (b.state) redirect.searchParams.set('state', b.state)
  return json({ redirect: redirect.toString() })
}

// ── トークンエンドポイント ───────────────────────────────
export async function token(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null)
  if (!form) return json({ error: 'invalid_request' }, 400)
  const f = (k: string) => (form.get(k) ? String(form.get(k)) : undefined)
  const grant = f('grant_type')

  if (grant === 'authorization_code') {
    const code = f('code'), verifier = f('code_verifier')
    const clientId = f('client_id'), redirectUri = f('redirect_uri')
    if (!code || !verifier) return json({ error: 'invalid_request' }, 400)

    const row = await store.takeCode(code) // 取得即削除（1回限り）
    if (!row) return json({ error: 'invalid_grant', error_description: 'code expired or used' }, 400)
    if (clientId && row.client_id !== clientId) return json({ error: 'invalid_client' }, 400)
    if (redirectUri && row.redirect_uri !== redirectUri) return json({ error: 'invalid_grant' }, 400)
    if (!(await store.verifyPkce(verifier, row.code_challenge)))
      return json({ error: 'invalid_grant', error_description: 'PKCE failed' }, 400)

    const t = await store.issueToken({
      client_id: row.client_id, user_id: row.user_id, refresh_token: row.refresh_token,
    })
    return json({ access_token: t.access_token, token_type: 'Bearer', expires_in: t.expires_in, scope: 'mcp' })
  }

  return json({ error: 'unsupported_grant_type' }, 400)
}
