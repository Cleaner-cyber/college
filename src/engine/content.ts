/**
 * 内容加载器：所有面向用户的文案均来自 /content 下的 JSON。
 * 引擎负责加载并注入关卡（关卡不自行 import 内容）。
 */
import type { LevelContent, Major, QuickAction, AbilityId } from '@/contracts';

import prologueJson from '@content/levels/prologue.json';
import courseSelectJson from '@content/levels/course-select.json';
import posterJson from '@content/levels/poster.json';
import settlementJson from '@content/levels/settlement.json';
import majorsJson from '@content/majors/majors.json';
import quickActionsY1s1 from '@content/quick-actions/y1s1.json';
import boardY1s1 from '@content/board/y1s1.json';
import uiJson from '@content/ui/ui.json';

const levelContents: Record<string, LevelContent> = {
  prologue: prologueJson as LevelContent,
  'course-select': courseSelectJson as LevelContent,
  poster: posterJson as LevelContent,
  settlement: settlementJson as LevelContent,
};

export function getLevelContent(id: string): LevelContent {
  const c = levelContents[id];
  if (!c) throw new Error(`Missing level content: ${id}`);
  return c;
}

export const majors: Major[] = majorsJson as Major[];

export function getMajor(id: string): Major {
  return majors.find((m) => m.id === id) ?? majors.find((m) => m.id === 'generic')!;
}

export function searchMajors(query: string): Major[] {
  const list = majors.filter((m) => m.id !== 'generic');
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (m) => m.name.toLowerCase().includes(q) || m.aliases.some((a) => a.toLowerCase().includes(q)),
  );
}

export const quickActions: Record<string, QuickAction[]> = {
  y1s1: quickActionsY1s1 as QuickAction[],
};

export interface BoardLevelEntry {
  id: string;
  label: string;
  tag: string;
  cost: number;
  costWithAbility?: { ability: AbilityId; cost: number };
}

export interface BoardConfig {
  id: string;
  header: string;
  required: { id: string; label: string; tag: string; lockText: string };
  levels: BoardLevelEntry[];
  quickActionsRef: string;
}

export const boards: Record<string, BoardConfig> = {
  y1s1: boardY1s1 as BoardConfig,
};

// 引擎级 UI 文案（HUD、行动板、通用按钮）
export const ui = uiJson;

/** 文案插值：{playerName} {majorName} {clubName} 等 */
export function interpolate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (raw, key: string) => {
    const v = vars[key];
    return v === undefined || v === '' ? raw : String(v);
  });
}
