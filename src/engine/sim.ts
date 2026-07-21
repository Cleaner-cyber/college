/**
 * 模拟层引擎（docs/08 P0/P1）：条件评估 → 卡袋加权（特质/觉醒标签乘数）→ 抽卡（连锁优先）→ 检定；
 * 行动板（v2.2）：专业大类过滤 / 学期窗口 / 进阶链 / 适配分支选择。
 * 参照 lifeRestart 三层事件引擎（过滤→加权随机）与 Reigns 动态卡袋。
 */
import type { PlayerState, SimAction, SimActionBranch, SimCondition, SimEvent, TagDef } from '@/contracts';
import { tagDefs, getMajor, getSimEvents, getTrait, simActions, ui } from './content';

type Axes = PlayerState['axes'];

/** 学期序号（1=大一上 … 7=大四）；与 store.SEMESTER_CHAIN 保持同序（store 依赖本模块，不能反向引用） */
const SEMESTER_ORDER = ['y1s1', 'y1s2', 'y2s1', 'y2s2', 'y3s1', 'y3s2', 'y4'] as const;

export function semesterIndex(semester: string): number {
  return SEMESTER_ORDER.indexOf(semester as (typeof SEMESTER_ORDER)[number]) + 1; // 0 = 非在读学期
}

export function evalCondition(state: Readonly<PlayerState>, c?: SimCondition): boolean {
  if (!c) return true;
  if (c.minAxes && (Object.keys(c.minAxes) as (keyof Axes)[]).some((k) => state.axes[k] < (c.minAxes![k] ?? 0))) return false;
  if (c.maxAxes && (Object.keys(c.maxAxes) as (keyof Axes)[]).some((k) => state.axes[k] > (c.maxAxes![k] ?? 0))) return false;
  if (c.traits && !c.traits.some((t) => state.traits.includes(t))) return false;
  if (c.notTraits && c.notTraits.some((t) => state.traits.includes(t))) return false;
  if (c.minTags && Object.entries(c.minTags).some(([t, n]) => (state.tags[t] ?? 0) < n)) return false;
  if (c.notTags && c.notTags.some((t) => (state.tags[t] ?? 0) > 0)) return false;
  if (c.events && !c.events.some((e) => state.eventHistory.includes(e))) return false;
  if (c.notEvents && c.notEvents.some((e) => state.eventHistory.includes(e))) return false;
  if (c.abilities && !c.abilities.every((a) => state.abilities.includes(a))) return false;
  if (c.minActions && Object.entries(c.minActions).some(([id, n]) => (state.actionHistory[id] ?? 0) < n)) return false;
  const si = semesterIndex(state.semester);
  if (c.semesterMin !== undefined && si < c.semesterMin) return false;
  if (c.semesterMax !== undefined && si > c.semesterMax) return false;
  return true;
}

// ---------------- 行动板（v2.2） ----------------

/** 玩家专业大类（'any' 类玩家可见全部专业向行动） */
export function playerCategory(state: Readonly<PlayerState>): string {
  return getMajor(state.player.majorId).category ?? 'any';
}

export interface ActionView {
  action: SimAction;
  locked: boolean; // requires 未满足但有 lockedHint（展示进阶路径）
  done: boolean; // 本学期已做
  times: number; // 跨学期累计次数
}

/** 当前学期行动板可见条目（含锁定项）；专业不匹配/窗口外/一次性已做/无提示未达前置 → 隐藏 */
export function visibleActions(state: Readonly<PlayerState>): ActionView[] {
  const cat = playerCategory(state);
  return simActions.flatMap((a) => {
    if (a.majors && cat !== 'any' && !a.majors.includes(cat)) return [];
    if (a.semesters && !a.semesters.includes(state.semester)) return [];
    const times = state.actionHistory[a.id] ?? 0;
    if (a.once && times > 0) return [];
    const ok = evalCondition(state, a.requires);
    if (!ok && !a.lockedHint) return [];
    return [
      {
        action: a,
        locked: !ok,
        done: state.completedActions.includes(a.id),
        times,
      },
    ];
  });
}

/** 取第一个 when 命中的分支（末项无 when 作默认；理论上内容表保证必有兜底） */
export function pickBranch(state: Readonly<PlayerState>, action: SimAction): SimActionBranch {
  return action.branches.find((b) => evalCondition(state, b.when)) ?? action.branches[action.branches.length - 1];
}

/** 已觉醒标签（计数达阈值） */
export function awakenedTagIds(tags: Readonly<Record<string, number>>): string[] {
  return tagDefs.filter((t) => (tags[t.id] ?? 0) >= t.threshold).map((t) => t.id);
}

export function tagDef(id: string): TagDef | undefined {
  return tagDefs.find((t) => t.id === id);
}

/** 事件在当前状态下的实际权重（0 = 不可抽） */
export function eventWeight(state: Readonly<PlayerState>, ev: SimEvent): number {
  if (ev.weight <= 0) return 0; // 连锁专用卡
  if (state.eventHistory.includes(ev.id)) return 0; // 事件默认一次性
  if (!evalCondition(state, ev.include)) return 0;
  if (ev.exclude && Object.keys(ev.exclude).length > 0 && evalCondition(state, ev.exclude)) return 0;
  let w = ev.weight;
  if (ev.traitWeights) {
    for (const [t, m] of Object.entries(ev.traitWeights)) if (state.traits.includes(t)) w *= m;
  }
  if (ev.tagWeights) {
    const awakened = awakenedTagIds(state.tags);
    for (const [t, m] of Object.entries(ev.tagWeights)) if (awakened.includes(t)) w *= m;
  }
  return w;
}

/** 本学期还能抽到的事件数（含待触发的连锁卡） */
export function drawableCount(state: Readonly<PlayerState>): number {
  const pool = getSimEvents(state.semester);
  const pending = state.pendingEvents.filter((id) => pool.some((e) => e.id === id) && !state.eventHistory.includes(id)).length;
  return pending + pool.filter((e) => eventWeight(state, e) > 0).length;
}

/** 抽一张事件卡：连锁队列优先，否则条件过滤 + 加权随机 */
export function drawEvent(state: Readonly<PlayerState>): SimEvent | null {
  const pool = getSimEvents(state.semester);
  for (const id of state.pendingEvents) {
    const ev = pool.find((e) => e.id === id);
    if (ev && !state.eventHistory.includes(id)) return ev;
  }
  const weighted = pool
    .map((e) => [e, eventWeight(state, e)] as const)
    .filter(([, w]) => w > 0);
  if (weighted.length === 0) return null;
  let roll = Math.random() * weighted.reduce((s, [, w]) => s + w, 0);
  for (const [e, w] of weighted) {
    roll -= w;
    if (roll <= 0) return e;
  }
  return weighted[weighted.length - 1][0];
}

/** 检定成功率：轴值与难度差每 1 点 ±15%，钳制在 5%~95%（同值五五开） */
export function checkRate(axisValue: number, dc: number): number {
  return Math.min(0.95, Math.max(0.05, 0.5 + 0.15 * (axisValue - dc)));
}

/** 选项门槛的人话描述（目前只描述最常用的 minAxes / minTags） */
export function conditionLabel(c: SimCondition): string {
  const parts: string[] = [];
  if (c.minAxes) {
    for (const [k, v] of Object.entries(c.minAxes)) parts.push(`${ui.axes[k as keyof Axes]} ≥ ${v}`);
  }
  if (c.minTags) {
    for (const [t, n] of Object.entries(c.minTags)) parts.push(`${tagDef(t)?.name ?? t} × ${n}`);
  }
  if (c.traits) parts.push(c.traits.map((t) => `「${getTrait(t)?.name ?? t}」`).join('/'));
  return parts.join(' · ');
}
