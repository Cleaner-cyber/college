/**
 * 引擎唯一状态源。关卡不直接改 store，只通过 onComplete/onEscape 返回 LevelResult。
 * 持久化经 services/saveAdapter（云端 Supabase / 本地 localStorage 双模式）。
 * 经济模型 v2：主线教学关不耗行动点且必须全部完成才能结算；行动点只用于选修速结行动。
 */
import { create } from 'zustand';
import type { LevelResult, LogEntry, PlayerState, QuickAction } from '@/contracts';
import {
  getSaveAdapter,
  persistState,
  flushState,
} from '@/services/saveAdapter';
import { getBoard, getMajor, interpolate, semesterName, ui } from './content';

const SEMESTER_ACTION_POINTS = 3; // 每学期行动点（选修用）

function freshState(): PlayerState {
  return {
    version: 2,
    createdAt: new Date().toISOString(),
    player: { name: '', majorId: '' },
    flag: { salaryBand: '', city: '', workStyle: '', offTime: '' },
    axes: { academic: 0, portfolio: 0, expression: 0, cash: 0, energy: 0 },
    actionPoints: 0,
    semester: 'prologue',
    abilities: [],
    archive: [],
    completedActions: [],
    log: [],
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

/** 主线是否全部完成（结算学期的前置条件） */
export function isMainlineComplete(state: Readonly<PlayerState>): boolean {
  return getBoard(state.semester).mainline.every((m) => state.completedActions.includes(m.id));
}

const tmpl = ui['log-tmpl'] as Record<string, string>;

function logEntry(type: LogEntry['type'], key: string, vars: Record<string, string | number>): LogEntry {
  return { ts: new Date().toISOString(), type, text: interpolate(tmpl[key] ?? key, vars) };
}

function mainlineLabel(levelId: string, semester: string): string {
  return getBoard(semester).mainline.find((m) => m.id === levelId)?.label ?? levelId;
}

/** 学期链：结算后进入下一学期；y4 结算 → 毕业 */
const SEMESTER_CHAIN = ['y1s1', 'y1s2', 'y2s1', 'y2s2', 'y3s1', 'y3s2', 'y4'] as const;

export function nextSemester(current: string): PlayerState['semester'] {
  const i = SEMESTER_CHAIN.indexOf(current as (typeof SEMESTER_CHAIN)[number]);
  if (i >= 0 && i < SEMESTER_CHAIN.length - 1) return SEMESTER_CHAIN[i + 1];
  return 'grad-end';
}

export function isPlayingSemester(semester: string): boolean {
  return (SEMESTER_CHAIN as readonly string[]).includes(semester);
}

/** 旧档迁移：'*-end'（旧版 demo 终点）→ 开启下一学期 */
function migrate(state: PlayerState): PlayerState {
  const legacy: Record<string, PlayerState['semester']> = {
    'y1s1-end': 'y1s2',
    'y1s2-end': 'y2s1',
  };
  const to = legacy[state.semester as string];
  if (!to) return state;
  return {
    ...state,
    semester: to,
    actionPoints: SEMESTER_ACTION_POINTS,
    completedActions: [],
    log: [...state.log, logEntry('semester', 'semester-start', { semester: semesterName(to) })],
  };
}

interface EngineStore {
  state: PlayerState | null; // null = 尚未从存档水合
  ready: boolean;
  /** 从当前 SaveAdapter 读档；无档则新建 */
  hydrate: () => Promise<void>;
  /** 卸载状态（登出时用） */
  unload: () => void;
  /** 序章建档（引擎职责）：姓名 / 专业 / flag 局部合并 */
  setProfile: (patch: {
    name?: string;
    majorId?: string;
    flag?: Partial<PlayerState['flag']>;
  }) => void;
  /** 关卡结束（onComplete/onEscape 共用）：合并结果、记日志、学期流转、落盘 */
  applyLevelResult: (levelId: string, result: LevelResult) => void;
  /** 速结行动：扣行动点、数值、入档、记日志 */
  runQuickAction: (qa: QuickAction) => void;
  /** 清档重开 */
  reset: () => Promise<void>;
}

export const useEngine = create<EngineStore>((set) => ({
  state: null,
  ready: false,

  hydrate: async () => {
    const adapter = getSaveAdapter();
    const loaded = adapter ? await adapter.load() : null;
    set({ state: loaded ? migrate(loaded) : freshState(), ready: true });
  },

  unload: () => set({ state: null, ready: false }),

  setProfile: (patch) =>
    set((s) => {
      if (!s.state) return {};
      const next: PlayerState = {
        ...s.state,
        player: {
          name: patch.name ?? s.state.player.name,
          majorId: patch.majorId ?? s.state.player.majorId,
        },
        flag: { ...s.state.flag, ...patch.flag },
      };
      persistState(next);
      return { state: next };
    }),

  applyLevelResult: (levelId, result) =>
    set((s) => {
      const st = s.state;
      if (!st) return {};
      const borrowed = result.archiveItems.some((i) => i.borrowed);
      const newAbilities = result.abilityUnlocks.filter((a) => !st.abilities.includes(a));
      const log: LogEntry[] = [...st.log];

      let next: PlayerState = {
        ...st,
        axes: mergeDeltas(st.axes, result.deltas),
        abilities: [...st.abilities, ...newAbilities],
        archive: [
          ...st.archive,
          ...result.archiveItems.map((item) => ({ ...item, semester: st.semester })),
        ],
        completedActions: st.completedActions.includes(levelId)
          ? st.completedActions
          : [...st.completedActions, levelId],
        log,
      };

      if (levelId === 'prologue') {
        // 学期流转：入学 → 大一上
        log.push(
          logEntry('system', 'profile-created', {
            playerName: next.player.name,
            majorName: getMajor(next.player.majorId).name,
          }),
        );
        log.push(logEntry('semester', 'semester-start', { semester: semesterName('y1s1') }));
        next = {
          ...next,
          semester: 'y1s1',
          actionPoints: SEMESTER_ACTION_POINTS,
          completedActions: [],
        };
      } else if (levelId === 'settlement') {
        // 学期结算：剩余行动点转化为休息 → 进入下一学期或结束
        const remaining = next.actionPoints;
        log.push(
          logEntry('semester', 'semester-end', {
            semester: semesterName(st.semester),
            points: remaining,
          }),
        );
        const energy = next.axes.energy + remaining;
        const to = nextSemester(st.semester);
        if (to !== 'grad-end') {
          log.push(logEntry('semester', 'semester-start', { semester: semesterName(to) }));
          next = {
            ...next,
            axes: { ...next.axes, energy },
            actionPoints: SEMESTER_ACTION_POINTS,
            semester: to,
            completedActions: [],
          };
        } else {
          next = {
            ...next,
            axes: { ...next.axes, energy },
            actionPoints: 0,
            semester: 'grad-end',
          };
        }
      } else {
        log.push(
          logEntry('level', borrowed ? 'level-borrowed' : 'level-complete', {
            label: mainlineLabel(levelId, st.semester),
          }),
        );
      }

      newAbilities.forEach((a) =>
        log.push(logEntry('system', 'ability-unlock', { ability: ui.abilities[a] ?? a })),
      );

      flushState(next); // 关键节点：立即落盘
      return { state: next };
    }),

  runQuickAction: (qa) =>
    set((s) => {
      const st = s.state;
      if (!st) return {};
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
        log: [
          ...st.log,
          logEntry('quick', 'quick', { label: qa.label, result: qa.resultText }),
        ],
      };
      persistState(next);
      return { state: next };
    }),

  reset: async () => {
    const adapter = getSaveAdapter();
    if (adapter) await adapter.clear();
    const next = freshState();
    set({ state: next, ready: true });
    if (adapter) void adapter.save(next);
  },
}));
