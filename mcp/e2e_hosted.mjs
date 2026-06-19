// ホスト版MCP 実接続E2E：discovery→DCR→PKCE→authorize(302)→complete→token→mcp(initialize/tools/list/call)
// 実際のOAuthクライアント（Claude）と同じ順序でライブのEdge Functionを叩く。
import crypto from 'node:crypto'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const SUPABASE_URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_KEY
const EMAIL = env.TERA_EMAIL
const PASSWORD = env.TERA_PASSWORD
const MCP = `${SUPABASE_URL}/functions/v1/mcp`
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback'

const b64url = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
const ok = (c, m) => console.log(`${c ? '✅' : '❌'} ${m}`)
let fails = 0
const must = (c, m) => { if (!c) fails++; ok(c, m) }

// 0) discovery
const meta = await (await fetch(`${MCP}/.well-known/oauth-authorization-server`)).json()
must(meta.authorization_endpoint === `${MCP}/authorize`, `discovery: authorization_endpoint = ${meta.authorization_endpoint}`)
must(meta.code_challenge_methods_supported?.includes('S256'), 'discovery: S256 supported')

// protected-resource
const pr = await (await fetch(`${MCP}/.well-known/oauth-protected-resource`)).json()
must(pr.resource === MCP, `discovery: protected-resource.resource = ${pr.resource}`)

// 1) DCR
const reg = await (await fetch(`${MCP}/register`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ client_name: 'E2E Test', redirect_uris: [REDIRECT] }),
})).json()
must(!!reg.client_id, `DCR: client_id = ${reg.client_id}`)
const clientId = reg.client_id

// 2) PKCE
const verifier = b64url(crypto.randomBytes(32))
const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
const state = b64url(crypto.randomBytes(8))

// 3) authorize → 302 to frontend #/connect
const authUrl = `${MCP}/authorize?` + new URLSearchParams({
  client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge,
  code_challenge_method: 'S256', state, response_type: 'code',
})
const authRes = await fetch(authUrl, { redirect: 'manual' })
const loc = authRes.headers.get('location') ?? ''
must(authRes.status === 302, `authorize: status ${authRes.status}`)
must(loc.includes('/#/connect?'), `authorize: redirect → ${loc.slice(0, 70)}...`)
must(loc.includes(`code_challenge=${challenge}`), 'authorize: challenge forwarded to frontend')

// 4) ユーザーとしてSupabaseにサインイン（本体の接続画面の代役）→ refresh_token
const signin = await (await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'content-type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
})).json()
must(!!signin.refresh_token, `signin: user ${signin.user?.email}`)

// 5) /authorize/complete → 認可コード
const comp = await (await fetch(`${MCP}/authorize/complete`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge,
    refresh_token: signin.refresh_token, state,
  }),
})).json()
const code = comp.redirect ? new URL(comp.redirect).searchParams.get('code') : null
must(!!code, `complete: code issued = ${code?.slice(0, 12)}...`)
must(comp.redirect?.startsWith(REDIRECT), `complete: redirect back to ${REDIRECT}`)

// 6) /token （PKCE検証）→ access_token
const tokRes = await fetch(`${MCP}/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code', code, code_verifier: verifier,
    client_id: clientId, redirect_uri: REDIRECT,
  }),
})
const tok = await tokRes.json()
must(!!tok.access_token, `token: access_token = ${tok.access_token?.slice(0, 12)}... (expires_in=${tok.expires_in})`)
const access = tok.access_token

// 6b) 同じcodeの二度使い → invalid_grant（1回限りの確認）
const reuse = await (await fetch(`${MCP}/token`, {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT }),
})).json()
must(reuse.error === 'invalid_grant', `token: code reuse rejected (${reuse.error})`)

// 7) /mcp 無トークン → 401
const noauth = await fetch(MCP, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
must(noauth.status === 401, `mcp: no-token → ${noauth.status}`)

const rpc = async (method, params, id = 1) =>
  (await (await fetch(MCP, {
    method: 'POST',
    headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })).json())

// 8) initialize
const init = await rpc('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } })
must(!!init.result?.serverInfo, `mcp: initialize → ${init.result?.serverInfo?.name} ${init.result?.serverInfo?.version}`)

// 9) tools/list
const tools = await rpc('tools/list', {})
const names = (tools.result?.tools ?? []).map(t => t.name)
must(names.length >= 9, `mcp: tools/list → ${names.length} tools [${names.join(', ')}]`)

// 10) tools/call get_context（実データ・RLS確認）
const ctx = await rpc('tools/call', { name: 'get_context', arguments: {} })
const ctxText = ctx.result?.content?.[0]?.text ?? JSON.stringify(ctx)
must(!ctx.error, `mcp: get_context → ${ctxText.slice(0, 120)}`)

// 11) tools/call list_goals（本人のゴールが読めるか）
const goals = await rpc('tools/call', { name: 'list_goals', arguments: {} })
const goalsText = goals.result?.content?.[0]?.text ?? JSON.stringify(goals)
must(!goals.error, `mcp: list_goals → ${goalsText.slice(0, 120)}`)

console.log(`\n${fails === 0 ? '🎉 ALL PASS' : `⚠️ ${fails} FAILED`}`)
process.exit(fails === 0 ? 0 : 1)
