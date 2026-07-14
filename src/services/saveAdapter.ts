/**
 * 存档适配器：云端（Supabase game_saves 表）与本地（localStorage）两种实现。
 * 引擎只面向 SaveAdapter 接口；写入做防抖，关键节点可 flush。
 */
import { SAVE_KEY, SAVE_VERSION, type PlayerState } from '@/contracts';
import { supabase } from './supabase';

export interface SaveAdapter {
  load(): Promise<PlayerState | null>;
  save(state: PlayerState): Promise<void>;
  clear(): Promise<void>;
}

function parseState(raw: unknown): PlayerState | null {
  const state = raw as PlayerState | null;
  if (!state || state.version !== SAVE_VERSION) return null; // 版本不符→重开（demo 不做迁移）
  return state;
}

export class LocalSaveAdapter implements SaveAdapter {
  async load(): Promise<PlayerState | null> {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? parseState(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }
  async save(state: PlayerState): Promise<void> {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {
      /* 存储满/隐私模式：静默失败 */
    }
  }
  async clear(): Promise<void> {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
  }
}

export class SupabaseSaveAdapter implements SaveAdapter {
  constructor(private userId: string) {}

  async load(): Promise<PlayerState | null> {
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('game_saves')
      .select('state')
      .eq('user_id', this.userId)
      .maybeSingle();
    if (error || !data) return null;
    return parseState(data.state);
  }

  async save(state: PlayerState): Promise<void> {
    if (!supabase) return;
    await supabase.from('game_saves').upsert({
      user_id: this.userId,
      state,
      updated_at: new Date().toISOString(),
    });
  }

  async clear(): Promise<void> {
    if (!supabase) return;
    await supabase.from('game_saves').delete().eq('user_id', this.userId);
  }
}

// ---- 当前适配器（由 App 在认证解析后注入）+ 防抖写入 ----

let current: SaveAdapter | null = null;
let pending: PlayerState | null = null;
let timer: number | undefined;

export function setSaveAdapter(adapter: SaveAdapter | null): void {
  current = adapter;
  pending = null;
  if (timer) window.clearTimeout(timer);
}

export function getSaveAdapter(): SaveAdapter | null {
  return current;
}

/** 防抖持久化（800ms）；快速连点只写最后一份 */
export function persistState(state: PlayerState): void {
  if (!current) return;
  pending = state;
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    if (current && pending) void current.save(pending);
    pending = null;
  }, 800);
}

/** 关键节点（关卡完成/学期流转/登出前）立即落盘 */
export function flushState(state?: PlayerState): void {
  if (timer) window.clearTimeout(timer);
  const toWrite = state ?? pending;
  if (current && toWrite) void current.save(toWrite);
  pending = null;
}
