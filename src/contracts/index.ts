/**
 * 类型契约 —— 与 docs/02_数据契约.md 一一对应。
 * 【冻结件】改动需项目负责人确认，禁止自行扩展。
 * v2：桌面端 + 云存档版。新增行动日志 log；行动点只用于选修，教学关为主线必修。
 * v2.1：模拟层扩展（docs/08 方案 P0，已确认）——入学特质 / 学期事件流 / 标签；
 *       PlayerState 新增 traits / tags / axesPeak / eventHistory / pendingEvents。
 */
import type React from 'react';

// ---------- 1. PlayerState ----------

// v2.2：覆盖完整四年。'y1s1-end'/'y1s2-end' 仅存于旧档，水合时自动迁移到下一学期。
// 学期链：y1s1 → y1s2 → y2s1 → y2s2(含大二暑假) → y3s1 → y3s2(含大三暑假) → y4 → grad-end
export type SemesterId =
  | 'prologue'
  | 'y1s1'
  | 'y1s1-end'
  | 'y1s2'
  | 'y1s2-end'
  | 'y2s1'
  | 'y2s2'
  | 'y3s1'
  | 'y3s2'
  | 'y4'
  | 'grad-end';

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

/** 行动记录（Home 的「记录」页展示；文案由引擎用 /content 模板生成） */
export interface LogEntry {
  ts: string; // ISO
  type: 'level' | 'quick' | 'semester' | 'system';
  text: string;
}

export interface PlayerState {
  version: 2; // 存档版本，迁移用
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
  actionPoints: number; // 当前学期剩余行动点（只用于选修行动；主线教学关不耗点）
  semester: SemesterId;
  abilities: AbilityId[]; // 已解锁 AI 能力
  archive: ArchiveItem[]; // 档案（驱动简历/结局个性化）
  completedActions: string[]; // 本学期已执行的行动 id（含关卡与速结）
  log: LogEntry[]; // 全程行动记录
  // ---- v2.1 模拟层（旧档水合时补默认值）----
  traits: string[]; // 入学特质 id（序章抽取）
  tags: Record<string, number>; // 标签计数（选择累积，达阈值「觉醒」）
  axesPeak: PlayerState['axes']; // 各轴历史最高值（结算总评用）
  eventHistory: string[]; // 已经历的模拟事件 id（事件默认不重复；供条件/结局引用）
  pendingEvents: string[]; // 连锁事件队列（事件 next 入队，抽卡时优先弹出）
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

// ---------- 3.5 模拟层：入学特质 / 学期事件 / 标签（v2.1，docs/08 P0）----------

/** 结构化条件：全部字段同时满足（AND）；数组内任一命中即满足该字段（OR） */
export interface SimCondition {
  minAxes?: Partial<PlayerState['axes']>; // 各轴下限
  maxAxes?: Partial<PlayerState['axes']>; // 各轴上限（低精力事件等）
  traits?: string[]; // 含任一特质
  notTraits?: string[]; // 不含任何列出特质
  minTags?: Record<string, number>; // 标签计数下限
  notTags?: string[]; // 未沾任何列出标签（计数为 0）
  events?: string[]; // 已历任一事件
  notEvents?: string[]; // 未历任何列出事件
}

export interface SimOutcome {
  text: string; // 结果文案
  deltas?: Partial<PlayerState['axes']>;
  tags?: Record<string, number>; // 标签增量
  next?: string; // 连锁：目标事件入 pendingEvents，后续抽卡优先弹出
}

export interface SimEventOption {
  label: string;
  require?: SimCondition; // 选项门槛：不满足则灰显（数值被读取的第一现场）
  check?: { axis: keyof PlayerState['axes']; dc: number }; // 轴值检定，成败两分支
  result?: SimOutcome; // 无检定的直接结果
  success?: SimOutcome; // 检定成功
  fail?: SimOutcome; // 检定失败
}

/** 学期事件卡。weight=0 的事件不进随机池，只能被 next 连锁触发 */
export interface SimEvent {
  id: string;
  weight: number;
  include?: SimCondition; // 必须满足才入池
  exclude?: SimCondition; // 满足则出池
  traitWeights?: Record<string, number>; // 特质 → 权重乘数
  tagWeights?: Record<string, number>; // 已觉醒标签 → 权重乘数（Reigns 卡袋挤占）
  text: string;
  options: SimEventOption[];
}

/** 入学特质（序章展示 N 张抽 2）。deltas 在选定时一次性生效 */
export interface Trait {
  id: string;
  name: string;
  desc: string; // 面向玩家的效果描述
  deltas?: Partial<PlayerState['axes']>;
}

/** 标签定义：计数达 threshold 触发「觉醒」弹卡并重编事件卡袋 */
export interface TagDef {
  id: string;
  name: string;
  threshold: number;
  awakenText: string; // 「你正在成为：××」
}

// ---------- 4. 存档 ----------
// 云端：Supabase game_saves 表（user_id 主键 + state jsonb，RLS 仅本人可读写）
// 本地降级模式：localStorage（未配置 Supabase 环境变量时）

export const SAVE_KEY = 'unisim_save_v2';
export const SAVE_VERSION = 2 as const;
