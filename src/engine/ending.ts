/**
 * 毕业结局引擎（docs/08 P2）：
 * 总评分（峰值加权和）→ 档位；flag 对照（序章目标 vs 四年实绩）；
 * 身份卡按内容表优先级取第一张全命中；恰差一个条件的更高优先卡产出「差一点」提示。
 * 全部文案来自 content/sim/{endings,flag-checks,verdicts}.json。
 */
import type { EndingDef, PlayerState } from '@/contracts';
import { endings, flagChecks, interpolate, semesterName, ui, verdictConfig } from './content';
import { conditionMissCount, evalCondition, playerCategory } from './sim';

const FLAG_FIELDS = ['salaryBand', 'city', 'workStyle', 'offTime'] as const;
const SEMESTERS = ['y1s1', 'y1s2', 'y2s1', 'y2s2', 'y3s1', 'y3s2', 'y4'] as const;

/** 毕业总评分：四条可见轴峰值 ×2 + 精力峰值（会休息也计入总评，权重减半） */
export function computeSum(state: Readonly<PlayerState>): number {
  const p = state.axesPeak;
  return 2 * (p.academic + p.portfolio + p.expression + p.cash) + p.energy;
}

export function sumTier(sum: number): VerdictConfigSum {
  return verdictConfig.sum.find((t) => sum >= t.min) ?? verdictConfig.sum[verdictConfig.sum.length - 1];
}
type VerdictConfigSum = (typeof verdictConfig.sum)[number];

/** 单轴峰值短评（三档取首个命中） */
export function axisComment(axis: keyof PlayerState['axes'], peak: number): string {
  const tiers = verdictConfig.axes[axis] ?? [];
  return tiers.find((t) => peak >= t.min)?.text ?? '';
}

// ---------------- flag 对照 ----------------

export interface FlagResult {
  field: (typeof FLAG_FIELDS)[number];
  value: string; // 序章选的原值
  done: boolean;
  text: string; // 达成/未达成判语（天然达成型 missText 为空，不会走到）
}

/** 四条开局 flag 逐条对照（内容表缺项视为天然达成，判语留空） */
export function flagResults(state: Readonly<PlayerState>): FlagResult[] {
  return FLAG_FIELDS.map((field) => {
    const value = state.flag[field];
    const check = flagChecks.find((c) => c.field === field && c.value === value);
    if (!check) return { field, value, done: true, text: '' };
    const done = evalCondition(state, check.require);
    return { field, value, done, text: done ? check.doneText : check.missText };
  });
}

export function flagScore(state: Readonly<PlayerState>): number {
  return flagResults(state).filter((r) => r.done).length;
}

// ---------------- 身份卡 ----------------

/** 一张身份卡还差几个条件（专业不符 = 直接出局，不算「差一点」） */
export function endingMissCount(state: Readonly<PlayerState>, def: EndingDef): number {
  if (def.majors && !def.majors.includes(playerCategory(state))) return Number.POSITIVE_INFINITY;
  let miss = conditionMissCount(state, def.require);
  if (def.minActionKinds !== undefined && Object.keys(state.actionHistory).length < def.minActionKinds) miss += 1;
  if (def.minFlagScore !== undefined && flagScore(state) < def.minFlagScore) miss += 1;
  return miss;
}

/** 按内容表顺序取第一张全命中的卡；末张为无条件兜底 */
export function pickEnding(state: Readonly<PlayerState>): EndingDef {
  return endings.find((d) => endingMissCount(state, d) === 0) ?? endings[endings.length - 1];
}

/** 「差一点」：比命中卡优先级更高、恰差一个条件、且写了提示语的第一张卡 */
export function findAlmost(state: Readonly<PlayerState>, picked: EndingDef): EndingDef | null {
  for (const d of endings) {
    if (d.id === picked.id) break;
    if (d.almostHint && endingMissCount(state, d) === 1) return d;
  }
  return null;
}

// ---------------- 四年时间线 ----------------

export interface SemesterStory {
  semester: string;
  name: string; // 学期显示名
  highlight: string; // 该学期最有戏剧性的一条日志（无则空串）
}

/**
 * 按「学期开始」日志标记把 log 切成学期段，每段取最长的一条 quick 日志作高光
 * （事件/行动的结果文案越长越有戏），退而取第一条主线完成日志。
 * 标记文本由同一份 /content 模板插值得出，代码只做等值比较，不含硬编码文案。
 */
export function semesterStories(state: Readonly<PlayerState>): SemesterStory[] {
  const tmpl = (ui['log-tmpl'] as Record<string, string>)['semester-start'];
  const markers = new Map<string, string>(
    SEMESTERS.map((s) => [interpolate(tmpl, { semester: semesterName(s) }), s]),
  );
  const buckets: { semester: string; entries: PlayerState['log'] }[] = [];
  for (const entry of state.log) {
    const sem = entry.type === 'semester' ? markers.get(entry.text) : undefined;
    if (sem) {
      buckets.push({ semester: sem, entries: [] });
    } else if (buckets.length > 0) {
      buckets[buckets.length - 1].entries.push(entry);
    }
  }
  return buckets.map(({ semester, entries }) => {
    const quicks = entries.filter((e) => e.type === 'quick');
    const longest = quicks.reduce<string>((best, e) => (e.text.length > best.length ? e.text : best), '');
    const fallback = entries.find((e) => e.type === 'level')?.text ?? '';
    return { semester, name: semesterName(semester), highlight: longest || fallback };
  });
}

/** 当前学期的高光一条（结算 S1 用；毕业页用全量 semesterStories） */
export function currentHighlight(state: Readonly<PlayerState>): string {
  const stories = semesterStories(state);
  const cur = stories.find((s) => s.semester === state.semester) ?? stories[stories.length - 1];
  return cur?.highlight ?? '';
}
