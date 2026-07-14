/**
 * 引擎唯一状态源。关卡不直接改 store，只通过 onComplete/onEscape 返回 LevelResult。
 * 序章的建档写入（姓名/专业/flag）属于引擎的角色创建职责，经 setProfile 进行。
 */
import { create } from 'zustand';
import type { LevelResult, PlayerState, QuickAction } from '@/contracts';
import { loadSave, writeSave, clearSave } from './save';

const SEMESTER_ACTION_POINTS = 3; // 大一上行动点

function freshState(): PlayerState {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    player: { name: '', majorId: '' },
    flag: { salaryBand: '', city: '', workStyle: '', offTime: '' },
    axes: { academic: 0, portfolio: 0, expression: 0, cash: 0, energy: 0 },
    actionPoints: 0,
    semester: 'prologue',
    abilities: [],
    archive: [],
    completedActions: [],
  };
}

function mergeDeltas(
  axes: PlayerState['axes'],
  deltas: Partial<PlayerState['axes']>,
): PlayerState['axes'] {
  const next = { ...axes };
  (Object.keys(deltas) as (keyof PlayerState['axes'])[]).forEach((k) => {
    next[k] = (next[k] ?? 0) + (deltas[k] ?? 0);
  });
  return next;
}

export function effectiveCost(
  base: number,
  costWithAbility: QuickAction['costWithAbility'],
  abilities: PlayerState['abilities'],
): number {
  if (costWithAbility && abilities.includes(costWithAbility.ability)) {
    return costWithAbility.cost;
  }
  return base;
}

interface EngineStore {
  state: PlayerState;
  /** 序章建档（引擎职责）：姓名 / 专业 / flag 局部合并 */
  setProfile: (patch: {
    name?: string;
    majorId?: string;
    flag?: Partial<PlayerState['flag']>;
  }) => void;
  /** 关卡结束（onComplete / onEscape 共用）：合并结果、扣行动点、流转学期、存档 */
  applyLevelResult: (levelId: string, cost: number, result: LevelResult) => void;
  /** 速结行动：扣点、数值、入档、存档 */
  runQuickAction: (qa: QuickAction) => void;
  reset: () => void;
}

export const useEngine = create<EngineStore>((set) => ({
  state: loadSave() ?? freshState(),

  setProfile: (patch) =>
    set((s) => {
      const next: PlayerState = {
        ...s.state,
        player: {
          name: patch.name ?? s.state.player.name,
          majorId: patch.majorId ?? s.state.player.majorId,
        },
        flag: { ...s.state.flag, ...patch.flag },
      };
      writeSave(next);
      return { state: next };
    }),

  applyLevelResult: (levelId, cost, result) =>
    set((s) => {
      const st = s.state;
      let next: PlayerState = {
        ...st,
        axes: mergeDeltas(st.axes, result.deltas),
        actionPoints: Math.max(0, st.actionPoints - cost),
        abilities: [
          ...st.abilities,
          ...result.abilityUnlocks.filter((a) => !st.abilities.includes(a)),
        ],
        archive: [
          ...st.archive,
          ...result.archiveItems.map((item) => ({ ...item, semester: st.semester })),
        ],
        completedActions: st.completedActions.includes(levelId)
          ? st.completedActions
          : [...st.completedActions, levelId],
      };
      // 学期流转
      if (levelId === 'prologue') {
        next = {
          ...next,
          semester: 'y1s1',
          actionPoints: SEMESTER_ACTION_POINTS,
          completedActions: [],
        };
      } else if (levelId === 'settlement') {
        next = { ...next, semester: 'y1s1-end' };
      }
      writeSave(next);
      return { state: next };
    }),

  runQuickAction: (qa) =>
    set((s) => {
      const st = s.state;
      if (st.completedActions.includes(qa.id)) return {};
      const cost = effectiveCost(qa.cost, qa.costWithAbility, st.abilities);
      if (cost > st.actionPoints) return {};
      const next: PlayerState = {
        ...st,
        axes: mergeDeltas(st.axes, qa.deltas),
        actionPoints: st.actionPoints - cost,
        archive: qa.archiveItem
          ? [...st.archive, { ...qa.archiveItem, semester: st.semester, borrowed: false }]
          : st.archive,
        completedActions: [...st.completedActions, qa.id],
      };
      writeSave(next);
      return { state: next };
    }),

  reset: () => {
    clearSave();
    return set({ state: freshState() });
  },
}));
