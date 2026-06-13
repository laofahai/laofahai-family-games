// Supabase 客户端。仅用公开的 URL + anon/publishable key（由行级安全 RLS 保护）。
// env 缺失时（例如未配置密钥的 CI 构建）client 为 null，调用方应回退到本地存储，
// 保证 App 在没有后端时依然能用。

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey)
  : null
