/**
 * 内容加载器：所有面向用户的文案均来自 /content 下的 JSON。
 * 引擎负责加载并注入关卡（关卡不自行 import 内容）。
 */
import type { EndingDef, FlagCheck, LevelContent, Major, MajorDetail, PathDef, SimAction, SimEvent, TagDef, Trait } from '@/contracts';

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
import libraryJson from '@content/levels/library.json';
import majorsJson from '@content/majors/catalog.json';
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
import endingsJson from '@content/sim/endings.json';
import pathsJson from '@content/sim/paths.json';
import flagChecksJson from '@content/sim/flag-checks.json';
import verdictsJson from '@content/sim/verdicts.json';

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
  // 非关卡的内容库（知识文档等），只作为文案源被 DocViewer 引用
  library: libraryJson as unknown as LevelContent,
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

/** 按 id 取专业；旧版短 id（se/cs…）经 aliases 兜底（旧档兼容），再兜底 generic */
export function getMajor(id: string): Major {
  return (
    majors.find((m) => m.id === id) ??
    majors.find((m) => m.aliases.includes(id)) ??
    majors.find((m) => m.id === 'generic')!
  );
}

export function searchMajors(query: string): Major[] {
  const list = majors.filter((m) => m.id !== 'generic');
  const q = query.trim().toLowerCase();
  if (!q) return list;
  const hit = list.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      (m.klass ?? '').toLowerCase().includes(q) ||
      m.aliases.some((a) => a.toLowerCase().includes(q)),
  );
  // 名称前缀命中优先（「软件」→「软件工程」排最前）
  return hit.sort((a, b) => Number(b.name.startsWith(query.trim())) - Number(a.name.startsWith(query.trim())));
}

/** 序章分级浏览：门类 → 专业类 → 专业（保持目录原序） */
export interface MajorGroup {
  name: string; // 门类
  klasses: { name: string; majors: Major[] }[];
}

export const majorGroups: MajorGroup[] = (() => {
  const groups: MajorGroup[] = [];
  for (const m of majors) {
    if (!m.group) continue;
    let g = groups.find((x) => x.name === m.group);
    if (!g) groups.push((g = { name: m.group, klasses: [] }));
    let k = g.klasses.find((x) => x.name === m.klass);
    if (!k) g.klasses.push((k = { name: m.klass ?? m.group, majors: [] }));
    k.majors.push(m);
  }
  return groups;
})();

/** 单专业详情（速览卡 + 知识库全文小节）：同源静态资源按需加载，失败返回 null（卡片降级为只显示名称） */
export async function fetchMajorDetail(id: string): Promise<MajorDetail | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}assets/majors/${encodeURIComponent(id)}.json`);
    if (!res.ok) return null;
    return (await res.json()) as MajorDetail;
  } catch {
    return null;
  }
}

// 行动板（v2.2：全学期统一池，专业/窗口/进阶链过滤见 engine/sim.ts）
export const simActions: SimAction[] = actionsJson as SimAction[];

export function getSimAction(id: string): SimAction | undefined {
  return simActions.find((a) => a.id === id);
}

// ---- 出路系统内容（v2.6）----
export const paths: PathDef[] = pathsJson as PathDef[];

// ---- 结局系统内容（v2.3，docs/08 P2）----
export const endings: EndingDef[] = endingsJson as EndingDef[];
export const flagChecks: FlagCheck[] = flagChecksJson as FlagCheck[];

/** 毕业总评配置：加权总分档位 + 各轴峰值三档短评（min 降序，取第一个命中档） */
export interface VerdictConfig {
  sum: { min: number; tier: string; title: string; text: string }[];
  axes: Record<string, { min: number; text: string }[]>;
}
export const verdictConfig: VerdictConfig = verdictsJson as VerdictConfig;

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
