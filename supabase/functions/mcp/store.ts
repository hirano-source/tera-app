// OAuthの保管庫（service_role でRLSを迂回して oauth_* 表を読み書きする）。
// ここは「保存・引き換え・破棄」だけに徹し、認可ロジックは oauth.ts が持つ。
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// service_role クライアント（RLSを迂回。oauth_* 表の管理専用）
const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── 乱数・PKCE ───────────────────────────────────────────
const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')

export function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

// PKCE: S256(verifier) が challenge と一致するか
export async function verifyPkce(verifier: string, challenge: string): Promise<boolean> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return b64url(new Uint8Array(digest)) === challenge
}

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString()

// ── クライアント（DCR） ──────────────────────────────────
export async function registerClient(name: string, redirectUris: string[]) {
  const client_id = 'tera_' + randomToken(16)
  const { error } = await admin.from('oauth_clients')
    .insert({ client_id, client_name: name, redirect_uris: redirectUris })
  if (error) throw new Error(error.message)
  return { client_id, redirect_uris: redirectUris }
}

export async function getClient(clientId: string) {
  const { data } = await admin.from('oauth_clients')
    .select('client_id,redirect_uris').eq('client_id', clientId).maybeSingle()
  return data
}

// ── 認可コード ───────────────────────────────────────────
export async function saveCode(row: {
  client_id: string; redirect_uri: string; code_challenge: string
  user_id: string; refresh_token: string; resource?: string
}) {
  const code = randomToken(32)
  const { error } = await admin.from('oauth_codes')
    .insert({ code, ...row, expires_at: minutesFromNow(5) })
  if (error) throw new Error(error.message)
  return code
}

// 1回限り：取得と同時に削除する
export async function takeCode(code: string) {
  const { data } = await admin.from('oauth_codes').select('*').eq('code', code).maybeSingle()
  if (data) await admin.from('oauth_codes').delete().eq('code', code)
  if (!data || new Date(data.expires_at) < new Date()) return null
  return data
}

// ── アクセストークン ─────────────────────────────────────
export async function issueToken(row: { client_id: string; user_id: string; refresh_token: string }) {
  const access_token = randomToken(32)
  const { error } = await admin.from('oauth_tokens')
    .insert({ access_token, ...row, expires_at: minutesFromNow(60 * 24 * 30) })
  if (error) throw new Error(error.message)
  return { access_token, expires_in: 60 * 60 * 24 * 30 }
}

export async function lookupToken(accessToken: string) {
  const { data } = await admin.from('oauth_tokens').select('*').eq('access_token', accessToken).maybeSingle()
  if (!data || new Date(data.expires_at) < new Date()) return null
  return data
}

// リフレッシュトークンは使うたびに回転する。最新の種に更新して次回に備える。
export async function rotateRefresh(accessToken: string, refresh_token: string) {
  await admin.from('oauth_tokens').update({ refresh_token }).eq('access_token', accessToken)
}
