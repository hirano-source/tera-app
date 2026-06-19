import { createClient } from '@supabase/supabase-js'

// Supabaseクライアント。URL・publishableキーは .env（VITE_接頭辞）から読む。
// このキーはクライアント公開用。データ保護はDB側のRLSが担う。
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

if (!url || !key) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_KEY が未設定です')
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // Web Locks API がプレビュー/一部環境でデッドロックし、
    // セッション復元後のクエリがハングするのを回避する no-op ロック。
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
})
