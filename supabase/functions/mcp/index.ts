// ホスト版TERA MCP：司令塔（ルーター）。
// 1つのEdge Functionで OAuth(発見/登録/認可/トークン) と MCP(JSON-RPC) を出し分ける。
// ロジックは oauth.ts / mcp.ts / supa.ts / store.ts に委譲し、ここは振り分けに徹する。
import * as oauth from './oauth.ts'
import * as store from './store.ts'
import * as supa from './supa.ts'
import { handleRpc } from './mcp.ts'

// この関数の「公開」絶対URL（MCPリソース）を決める。
// Supabaseの内部ルーティングではリクエストのhostが edge-runtime.supabase.com に
// なり、公開URL（…supabase.co/functions/v1/mcp）が復元できない。そのため
// MCP_PUBLIC_URL（シークレット）を最優先で使う。発見/認可で案内するURLの根。
const SUFFIXES = [
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-authorization-server',
  '/.well-known/openid-configuration',
  '/authorize', '/token', '/register',
]
const PUBLIC_URL = Deno.env.get('MCP_PUBLIC_URL')?.replace(/\/$/, '')

function baseUrl(req: Request): { base: string; path: string } {
  const url = new URL(req.url)
  if (PUBLIC_URL) return { base: PUBLIC_URL, path: url.pathname }
  // フォールバック（カスタムドメイン等でhostが正しく届く場合）
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host
  let path = url.pathname.replace(/\/$/, '')
  for (const s of SUFFIXES) if (path.endsWith(s)) { path = path.slice(0, -s.length); break }
  return { base: `${proto}://${host}${path || '/'}`, path: url.pathname }
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type, mcp-protocol-version',
}

function unauthorized(base: string) {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: {
      'content-type': 'application/json',
      'www-authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
      ...cors,
    },
  })
}

// MCP本体：Bearer解決 →「そのユーザー」文脈 → JSON-RPC処理（単発/バッチ）。
async function handleMcp(req: Request, base: string): Promise<Response> {
  if (req.method === 'GET') return unauthorized(base) // SSEストリームは張らない（ステートレス）

  const auth = req.headers.get('authorization') ?? ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) return unauthorized(base)

  const tok = await store.lookupToken(m[1])
  if (!tok) return unauthorized(base)

  let ctx
  try {
    ctx = await supa.contextFromRefresh(tok.refresh_token)
    await store.rotateRefresh(tok.access_token, ctx.refreshToken) // 回転後の種を保存
  } catch {
    return unauthorized(base) // セッション失効 → 再認可させる
  }

  const body = await req.json().catch(() => null)
  if (body === null) return new Response(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }), { status: 400, headers: { 'content-type': 'application/json', ...cors } })

  const msgs = Array.isArray(body) ? body : [body]
  const out = []
  for (const msg of msgs) {
    const res = await handleRpc(msg, ctx)
    if (res) out.push(res)
  }
  // 通知のみ（応答不要）なら 202、それ以外はJSONで返す
  if (out.length === 0) return new Response(null, { status: 202, headers: cors })
  const payload = Array.isArray(body) ? out : out[0]
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json', ...cors },
  })
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

  const { base, path } = baseUrl(req)
  try {
    if (path.endsWith('/.well-known/oauth-protected-resource')) return oauth.protectedResource(base)
    if (path.endsWith('/.well-known/oauth-authorization-server') ||
        path.endsWith('/.well-known/openid-configuration')) return oauth.authServerMetadata(base)
    if (path.endsWith('/register')) return oauth.register(req)
    if (path.endsWith('/authorize/complete')) return oauth.authorizeComplete(req)
    if (path.endsWith('/authorize')) return oauth.authorize(req)
    if (path.endsWith('/token')) return oauth.token(req)
    return handleMcp(req, base) // 既定（/mcp 本体）
  } catch (e) {
    return new Response(JSON.stringify({ error: 'server_error', message: (e as Error).message }), {
      status: 500, headers: { 'content-type': 'application/json', ...cors },
    })
  }
})
