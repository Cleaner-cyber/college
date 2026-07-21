/**
 * 内容加载器：所有面向用户的文案均来自 /content 下的 JSON。
 * 引擎负责加载并注入关卡（关卡不自行 import 内容）。
 */
import type { LevelContent, Major, SimAction, SimEvent, TagDef, Trait } from '@/contracts';

import prologueJson from '@content/levels/prologue.json';
import courseSelectJson from '@content/levels/course-select.json';
import posterJson from '@content/levels/poster.json';
import pptJson from '@content/levels/ppt.json';
import codingJson from '@content/levels/coding.json';
import mentorJson from '@content/levels/mentor.json';
import notesJson from '@content/levels/notes.json';
import dachuangJson from '@content/levels/dachuang.json';
import gigJson from '@content/levels/gig.json';
import resumeJson from '@content/levels/resume.json';
import examinerJson from '@content/levels/examiner.json';
import forkJson from '@content/levels/fork.json';
import interviewJson from '@content/levels/interview.json';
import thesisJson from '@content/levels/thesis.json';
import settlementJson from '@content/levels/settlement.json';
import majorsJson from '@content/majors/majors.json';
import actionsJson from '@content/sim/actions.json';
import boardY1s1 from '@content/board/y1s1.json';
import boardY1s2 from '@content/board/y1s2.json';
import boardY2s1 from '@content/board/y2s1.json';
import boardY2s2 from '@content/board/y2s2.json';
import boardY3s1 from '@content/board/y3s1.json';
import boardY3s2 from '@content/board/y3s2.json';
import boardY4 from '@content/board/y4.json';
import uiJson from '@content/ui/ui.json';
import folderJson from '@content/folder/folder.json';
import traitsJson from '@content/sim/traits.json';
import tagsJson from '@content/sim/tags.json';
import simEventsY1s1 from '@content/sim/events-y1s1.json';
import simEventsY1s2 from '@content/sim/events-y1s2.json';
import simEventsY2s1 from '@content/sim/events-y2s1.json';
import simEventsY2s2 from '@content/sim/events-y2s2.json';
import simEventsY3s1 from '@content/sim/events-y3s1.json';
import simEventsY3s2 from '@content/sim/events-y3s2.json';
import simEventsY4 from '@content/sim/events-y4.json';

const levelContents: Record<string, LevelContent> = {
  prologue: prologueJson as LevelContent,
  'course-select': courseSelectJson as LevelContent,
  poster: posterJson as LevelContent,
  ppt: pptJson as LevelContent,
  coding: codingJson as LevelContent,
  mentor: mentorJson as LevelContent,
  notes: notesJson as LevelContent,
  dachuang: dachuangJson as LevelContent,
  gig: gigJson as LevelContent,
  resume: resumeJson as LevelContent,
  examiner: examinerJson as LevelContent,
  fork: forkJson as LevelContent,
  interview: interviewJson as LevelContent,
  thesis: thesisJson as LevelContent,
  settlement: settlementJson as LevelContent,
};

export function getLevelContent(id: string): LevelContent {
  const c = levelContents[id];
  if (!c) throw new Error(`Missing level content: ${id}`);
  return c;
}

// ---- 模拟层内容（docs/08 P0）----
export const traits: Trait[] = traitsJson as Trait[];
export const tagDefs: TagDef[] = tagsJson as TagDef[];

export function getTrait(id: string): Trait | undefined {
  return traits.find((t) => t.id === id);
}

const simEvents: Record<string, SimEvent[]> = {
  y1s1: simEventsY1s1 as SimEvent[],
  y1s2: simEventsY1s2 as SimEvent[],
  y2s1: simEventsY2s1 as SimEvent[],
  y2s2: simEventsY2s2 as SimEvent[],
  y3s1: simEventsY3s1 as SimEvent[],
  y3s2: simEventsY3s2 as SimEvent[],
  y4: simEventsY4 as SimEvent[],
};

export function getSimEvents(semester: string): SimEvent[] {
  return simEvents[semester] ?? [];
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

// 行动板（v2.2：全学期统一池，专业/窗口/进阶链过滤见 engine/sim.ts）
export const simActions: SimAction[] = actionsJson as SimAction[];

export function getSimAction(id: string): SimAction | undefined {
  return simActions.find((a) => a.id === id);
}

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
}

export const boards: Record<string, BoardConfig> = {
  y1s1: boardY1s1 as BoardConfig,
  y1s2: boardY1s2 as BoardConfig,
  y2s1: boardY2s1 as BoardConfig,
  y2s2: boardY2s2 as BoardConfig,
  y3s1: boardY3s1 as BoardConfig,
  y3s2: boardY3s2 as BoardConfig,
  y4: boardY4 as BoardConfig,
};

/** 学期 → 行动板配置（*-end 复用对应学期；prologue 前瞻 y1s1；grad-end 复用 y4） */
export function getBoard(semester: string): BoardConfig {
  if (semester === 'grad-end') return boards.y4;
  for (const key of ['y1s1', 'y1s2', 'y2s1', 'y2s2', 'y3s1', 'y3s2', 'y4']) {
    if (semester.startsWith(key) && (semester === key || semester === key + '-end')) {
      return boards[key];
    }
  }
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
