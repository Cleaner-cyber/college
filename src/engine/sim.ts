/**
 * 模拟层引擎（docs/08 P0）：条件评估 → 卡袋加权（特质/觉醒标签乘数）→ 抽卡（连锁优先）→ 检定。
 * 参照 lifeRestart 三层事件引擎（过滤→加权随机）与 Reigns 动态卡袋。
 */
import type { PlayerState, SimCondition, SimEvent, TagDef } from '@/contracts';
import { tagDefs, getSimEvents, getTrait, ui } from './content';

type Axes = PlayerState['axes'];

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
  return true;
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
