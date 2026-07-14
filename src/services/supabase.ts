/**
 * Supabase 客户端。未配置环境变量时为 null → 应用自动进入本地试玩模式。
 * 配置方法见 docs/07_后端与部署.md 与 .env.example。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isCloudMode = supabase !== null;
