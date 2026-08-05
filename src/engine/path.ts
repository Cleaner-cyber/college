/**
 * 出路系统（v2.6）：开局六选一目标（考研/保研/考公/就业/出国/创业），
 * 毕业按四年行为逐条计分 → 走通概率（clamp 5~95%）+ 每条因子的加/扣分解释（含「无用功」点破）。
 * 权重与话术全部来自 content/sim/paths.json。
 */
import type { PathDef, PathFactor, PlayerState } from '@/contracts';
import { paths } from './content';
import { awakenedTagIds, cumulativeGpa } from './sim';

export interface FactorResult {
  label: string;
  note: string;
  points: number; // 实际得分（0 = 未命中，不展示）
}

export interface PathResult {
  def: PathDef;
  prob: number; // 5~95
  factors: FactorResult[]; // 非零因子，按 |points| 降序
}

export function getPath(id: string): PathDef | undefined {
  return paths.find((p) => p.id === id);
}

function factorPoints(state: Readonly<PlayerState>, f: PathFactor): number {
  const gpa = cumulativeGpa(state) ?? 0;
  const cap = (v: number) => (f.cap !== undefined ? Math.sign(v) * Math.min(Math.abs(v), f.cap) : v);
  switch (f.type) {
    case 'minPeak':
      return state.axesPeak[f.axis!] >= (f.min ?? 0) ? (f.points ?? 0) : 0;
    case 'gpa':
      return gpa >= (f.min ?? 0) ? (f.points ?? 0) : 0;
    case 'action':
      return (state.actionHistory[f.id!] ?? 0) >= (f.min ?? 1) ? (f.points ?? 0) : 0;
    case 'tagAwakened':
      return awakenedTagIds(state.tags).includes(f.id!) ? (f.points ?? 0) : 0;
    case 'anyEvent':
      return (f.ids ?? []).some((e) => state.eventHistory.includes(e)) ? (f.points ?? 0) : 0;
    case 'ability':
      return (state.abilities as string[]).includes(f.id!) ? (f.points ?? 0) : 0;
    case 'trait':
      return state.traits.includes(f.id!) ? (f.points ?? 0) : 0;
    case 'kinds':
      return Object.keys(state.actionHistory).length >= (f.min ?? 0) ? (f.points ?? 0) : 0;
    case 'peakScale': {
      const over = state.axesPeak[f.axis!] - (f.from ?? 0);
      return over > 0 || (f.each ?? 0) < 0 ? cap(Math.max(0, over) * (f.each ?? 0)) : 0;
    }
    case 'gpaScale': {
      const over = gpa - (f.from ?? 0);
      return over > 0 ? cap(over * (f.each ?? 0)) : 0;
    }
    case 'actionScale': {
      const n = (f.ids ?? []).reduce((s, id) => s + (state.actionHistory[id] ?? 0), 0);
      return cap(n * (f.each ?? 0));
    }
    default:
      return 0;
  }
}

/** 计算某条出路的走通概率与因子明细 */
export function evalPath(state: Readonly<PlayerState>, def: PathDef): PathResult {
  const factors = def.factors
    .map((f) => ({ label: f.label, note: f.note, points: Math.round(factorPoints(state, f)) }))
    .filter((r) => r.points !== 0)
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const raw = def.base + factors.reduce((s, r) => s + r.points, 0);
  return { def, prob: Math.min(95, Math.max(5, Math.round(raw))), factors };
}

/** 玩家所选出路的毕业判定（未选 → null，旧档兼容） */
export function pathResult(state: Readonly<PlayerState>): PathResult | null {
  const def = getPath(state.pathGoal);
  return def ? evalPath(state, def) : null;
}
