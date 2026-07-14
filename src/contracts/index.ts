/**
 * 类型契约 —— 与 docs/02_数据契约.md 一一对应。
 * 【冻结件】改动需项目负责人确认，禁止自行扩展。
 */
import type React from 'react';

// ---------- 1. PlayerState ----------

export type SemesterId = 'prologue' | 'y1s1' | 'y1s1-end';

export type AbilityId =
  | 'doc-feeding' // 投喂长文档（demo：选课关解锁）
  | 'image-gen' // 生图+迭代（demo：海报关解锁）
  | 'role-play'
  | 'structured-gen'
  | 'ai-coding'
  | 'examiner'
  | 'note-taking'
  | 'lit-review'
  | 'data-analysis'
  | 'multimodal'; // 预留

export interface ArchiveItem {
  id: string; // 唯一
  levelId: string; // 来源关卡/行动
  semester: SemesterId;
  title: string; // 展示名，如「社团招新海报 · 双版本」
  resumeLine: string; // 将来简历关引用的措辞
  borrowed: boolean; // 是否走了[问学长]
  assetRef?: string; // 关联资产 id（可选）
}

export interface PlayerState {
  version: 1; // 存档版本，迁移用
  createdAt: string; // ISO
  player: {
    name: string; // 打字输入①
    majorId: string; // 来自 majors 库的 id
  };
  flag: {
    // 开局立的四年目标，全点选
    salaryBand: string;
    city: string;
    workStyle: string;
    offTime: string;
  };
  axes: {
    academic: number; // 学术
    portfolio: number; // 作品
    expression: number; // 表达
    cash: number; // 现金
    energy: number; // 精力（隐藏轴）
  };
  actionPoints: number; // 当前学期剩余行动点
  semester: SemesterId;
  abilities: AbilityId[]; // 已解锁 AI 能力
  archive: ArchiveItem[]; // 档案（驱动简历/结局个性化）
  completedActions: string[]; // 本学期已执行的行动 id（含关卡与速结）
}

// ---------- 2. 关卡插件接口 ----------

export interface LevelModule {
  id: string; // 与 /content/levels/{id}.json 同名
  Component: React.FC<LevelProps>;
}

export interface LevelProps {
  state: Readonly<PlayerState>;
  content: LevelContent; // 引擎加载并注入，关卡不自行 import 内容
  onComplete: (result: LevelResult) => void; // 关卡唯一出口
  onEscape: (result: LevelResult) => void; // [问学长]出口，result 中条目 borrowed=true
}

export interface LevelResult {
  deltas: Partial<PlayerState['axes']>; // 数值变化
  archiveItems: Omit<ArchiveItem, 'semester'>[];
  abilityUnlocks: AbilityId[];
  checklistScore?: { done: number; total: number }; // 验收清单完成度
}

// ---------- 3. 内容 JSON 格式 ----------

export interface LevelContent {
  id: string;
  title: string;
  screens: Screen[];
  checklist?: ChecklistItem[]; // 验收清单（任务面板显示）
  presetAssets?: Record<string, string>; // 逻辑资产id → /public/assets 路径
  copy: Record<string, string>; // 零散文案键值（按钮、提示等）
}

export interface Screen {
  id: string; // 如 "S1"
  type: 'dialogue' | 'choice' | 'input' | 'workbench' | 'reveal' | 'deliver';
  speaker?: 'senpai' | 'npc' | 'system'; // dialogue 用
  npcName?: string; // 如 "学姐"
  text?: string; // 台词/正文，支持 {playerName} {majorName} {clubName} 插值
  choices?: Choice[]; // choice 用
  inputKey?: string; // input 用：写入哪个变量
  placeholder?: string;
  next?: string; // 默认跳转屏 id；choice 屏由选项决定
  effects?: ScreenEffects; // 该屏触发的表现
}

export interface Choice {
  id: string;
  label: string;
  next: string;
  setVar?: { key: string; value: string }; // 写入关卡局部变量（如风格选择）
  checkItem?: string; // 完成某验收项的 id
}

export interface ChecklistItem {
  id: string;
  label: string;
}

export interface ScreenEffects {
  typewriter?: boolean; // 打字机
  fakeLoading?: { ms: number; tips: string[] }; // 假生成等待 + 学长旁批轮播
  showAsset?: string; // 展示 presetAssets 中的逻辑资产（按局部变量插值）
  hud?: { hp?: number }; // 心率等 HUD 演出，预留
}

// ---------- 3.3 专业库 ----------

export interface Major {
  id: string;
  name: string; // "计算机科学与技术"
  aliases: string[]; // 搜索用
  card: {
    coreCourses: string[]; // 四年主干课（≤6）
    hardestY1: string[]; // 大一最难两门
    gpaKiller: string; // 绩点杀手
    destinations: string[]; // 毕业去向（≤4）
    secret: string; // "没人告诉你的一件事"
  };
}

// ---------- 3.4 速结行动 ----------

export interface QuickAction {
  id: string;
  label: string; // "刷绩点"
  cost: number; // 行动点
  costWithAbility?: { ability: AbilityId; cost: number }; // 折扣
  deltas: Partial<PlayerState['axes']>;
  resultText: string; // 结算一句话
  archiveItem?: Omit<ArchiveItem, 'semester' | 'borrowed'>;
  senpaiComment?: string; // 学长点评（可空）
}

// ---------- 4. 存档 ----------

export const SAVE_KEY = 'unisim_save_v1';
export const SAVE_VERSION = 1 as const;
