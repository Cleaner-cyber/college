/**
 * 出路系统（v2.6）：开局六选一目标（考研/保研/考公/就业/出国/创业），
 * 毕业按四年行为逐条计分 → 走通概率（clamp 5~95%）+ 每条因子的加/扣分解释（含「无用功」点破）。
 * 权重与话术全部来自 content/sim/paths.json。
 */
import type { PathDef, PathFactor, PlayerState } from '@/contracts';
import { paths, ui, interpolate, getFolderSection } from './content';
import { awakenedTagIds, cumulativeGpa } from './sim';

const pathCopy = ui.path as Record<string, string>;

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

/** 「借来的」惩罚：点[问学长]直接拿走学长的成品，产出会标 borrowed。
 *
 * 没有这条的话，全程点跳过和全程自己做，毕业概率一模一样——「借来的」就只是个展示标签，
 * 而「每个玩家都要真的经历一遍 AI 教学」这条产品底线也就只拦得住不点按钮的人。
 * 按借用比例扣分（不是按件数），这样做得多的人不会因为借了一件就被重罚。 */
const BORROW_MAX_PENALTY = 12;

function borrowedFactor(state: Readonly<PlayerState>): FactorResult | null {
  // 与毕业页「四年 N 件产出里你自己做的有 M 件」用同一个判据，扣分口径和展示口径必须一致
  const made = state.archive.filter((a) => getFolderSection(a.id) !== 'prompts');
  if (made.length === 0) return null;
  const borrowed = made.filter((a) => a.borrowed).length;
  if (borrowed === 0) return null;
  const ratio = borrowed / made.length;
  const points = -Math.round(ratio * BORROW_MAX_PENALTY);
  if (points === 0) return null;
  return {
    label: interpolate(pathCopy['borrowed-label'], { borrowed, total: made.length }),
    note: pathCopy['borrowed-note'],
    points,
  };
}

/** 计算某条出路的走通概率与因子明细 */
export function evalPath(state: Readonly<PlayerState>, def: PathDef): PathResult {
  const borrowed = borrowedFactor(state);
  const factors = def.factors
    .map((f) => ({ label: f.label, note: f.note, points: Math.round(factorPoints(state, f)) }))
    .concat(borrowed ? [borrowed] : [])
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
