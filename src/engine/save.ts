/**
 * 存档：localStorage，key = unisim_save_v1。
 * 读取失败或 version 不匹配 → 清空重开（demo 不做迁移）。
 */
import { SAVE_KEY, SAVE_VERSION, type PlayerState } from '@/contracts';

export function loadSave(): PlayerState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlayerState;
    if (parsed.version !== SAVE_VERSION) {
      localStorage.removeItem(SAVE_KEY);
      return null;
    }
    return parsed;
  } catch {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* ignore */
    }
    return null;
  }
}

export function writeSave(state: PlayerState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* 存储满/隐私模式：静默失败，游戏可继续 */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
