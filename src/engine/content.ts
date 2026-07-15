/**
 * 内容加载器：所有面向用户的文案均来自 /content 下的 JSON。
 * 引擎负责加载并注入关卡（关卡不自行 import 内容）。
 */
import type { LevelContent, Major, QuickAction } from '@/contracts';

import prologueJson from '@content/levels/prologue.json';
import courseSelectJson from '@content/levels/course-select.json';
import posterJson from '@content/levels/poster.json';
import pptJson from '@content/levels/ppt.json';
import settlementJson from '@content/levels/settlement.json';
import majorsJson from '@content/majors/majors.json';
import quickActionsY1s1 from '@content/quick-actions/y1s1.json';
import quickActionsY1s2 from '@content/quick-actions/y1s2.json';
import boardY1s1 from '@content/board/y1s1.json';
import boardY1s2 from '@content/board/y1s2.json';
import uiJson from '@content/ui/ui.json';
import folderJson from '@content/folder/folder.json';

const levelContents: Record<string, LevelContent> = {
  prologue: prologueJson as LevelContent,
  'course-select': courseSelectJson as LevelContent,
  poster: posterJson as LevelContent,
  ppt: pptJson as LevelContent,
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
  y1s2: quickActionsY1s2 as QuickAction[],
};

export interface BoardMainlineEntry {
  id: string; // 关卡 id
  label: string;
  tag: string; // 如「教学 · 投喂长文档」
  desc: string; // 卡片描述
}

export interface BoardConfig {
  id: string;
  header: string;
  mainline: BoardMainlineEntry[]; // 主线必修（教学关）：不耗行动点，顺序解锁，全部完成才能结算
  mainlineLockText: string;
  electivesLockText: string;
  quickActionsRef: string;
}

export const boards: Record<string, BoardConfig> = {
  y1s1: boardY1s1 as BoardConfig,
  y1s2: boardY1s2 as BoardConfig,
};

/** 学期 → 行动板配置（*-end 复用本学期配置；prologue 前瞻 y1s1） */
export function getBoard(semester: string): BoardConfig {
  if (semester.startsWith('y1s2')) return boards.y1s2;
  return boards.y1s1;
}

/** 学期显示名（取 header 的「大一上」部分） */
export function semesterName(semester: string): string {
  return getBoard(semester).header.split(' · ')[0];
}

// 引擎级 UI 文案（HUD、行动板、通用按钮）
export const ui = uiJson;

// 文件夹分区：作品集 / 提示词库 / 档案
export type FolderSection = 'works' | 'prompts' | 'docs';

const folderItems = (folderJson as { items: Record<string, string> }).items;

export function getFolderSection(itemId: string): FolderSection {
  const s = folderItems[itemId];
  if (s === 'works' || s === 'prompts' || s === 'docs') return s;
  return itemId.startsWith('prompt-') ? 'prompts' : 'docs';
}

/** 文案插值：{playerName} {majorName} {clubName} 等 */
export function interpolate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (raw, key: string) => {
    const v = vars[key];
    return v === undefined || v === '' ? raw : String(v);
  });
}
