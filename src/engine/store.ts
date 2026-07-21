/**
 * 引擎唯一状态源。关卡不直接改 store，只通过 onComplete/onEscape 返回 LevelResult。
 * 持久化经 services/saveAdapter（云端 Supabase / 本地 localStorage 双模式）。
 * 经济模型 v2：主线教学关不耗行动点且必须全部完成才能结算；行动点只用于选修速结行动。
 */
import { create } from 'zustand';
import type {
  LevelResult,
  LogEntry,
  PlayerState,
  SimAction,
  SimEvent,
  SimOutcome,
  TagDef,
} from '@/contracts';
import {
  getSaveAdapter,
  persistState,
  flushState,
} from '@/services/saveAdapter';
import { getBoard, getMajor, getTrait, interpolate, semesterName, tagDefs, ui } from './content';
import { awakenedTagIds, checkRate, drawEvent, evalCondition, pickBranch } from './sim';

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
    traits: [],
    tags: {},
    axesPeak: { academic: 0, portfolio: 0, expression: 0, cash: 0, energy: 0 },
    eventHistory: [],
    pendingEvents: [],
    actionHistory: {},
  };
}

/** 各轴历史最高值（结算总评用，lifeRestart 式） */
function mergePeak(peak: PlayerState['axes'], axes: PlayerState['axes']): PlayerState['axes'] {
  return {
    academic: Math.max(peak.academic, axes.academic),
    portfolio: Math.max(peak.portfolio, axes.portfolio),
    expression: Math.max(peak.expression, axes.expression),
    cash: Math.max(peak.cash, axes.cash),
    energy: Math.max(peak.energy, axes.energy),
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
  costWithAbility: SimAction['costWithAbility'],
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
export const SEMESTER_CHAIN = ['y1s1', 'y1s2', 'y2s1', 'y2s2', 'y3s1', 'y3s2', 'y4'] as const;

export function nextSemester(current: string): PlayerState['semester'] {
  const i = SEMESTER_CHAIN.indexOf(current as (typeof SEMESTER_CHAIN)[number]);
  if (i >= 0 && i < SEMESTER_CHAIN.length - 1) return SEMESTER_CHAIN[i + 1];
  return 'grad-end';
}

export function isPlayingSemester(semester: string): boolean {
  return (SEMESTER_CHAIN as readonly string[]).includes(semester);
}

/** 旧档迁移：'*-end'（旧版 demo 终点）→ 开启下一学期；v2.1 模拟层字段补默认值 */
function migrate(state: PlayerState): PlayerState {
  let next: PlayerState = {
    ...state,
    traits: state.traits ?? [],
    tags: state.tags ?? {},
    axesPeak: state.axesPeak ?? { ...state.axes },
    eventHistory: state.eventHistory ?? [],
    pendingEvents: state.pendingEvents ?? [],
    actionHistory: state.actionHistory ?? {},
  };
  const legacy: Record<string, PlayerState['semester']> = {
    'y1s1-end': 'y1s2',
    'y1s2-end': 'y2s1',
  };
  const to = legacy[next.semester as string];
  if (to) {
    next = {
      ...next,
      semester: to,
      actionPoints: SEMESTER_ACTION_POINTS,
      completedActions: [],
      log: [...next.log, logEntry('semester', 'semester-start', { semester: semesterName(to) })],
    };
  }
  return next;
}

/** 事件结算的瞬态结果（弹窗展示用，不入存档） */
export interface SimResolution {
  optionIndex: number;
  success: boolean | null; // null = 无检定
  rate?: number; // 检定成功率（展示）
  outcome: SimOutcome;
  awakened: TagDef[]; // 本次新觉醒的标签
}

/** 行动结算的瞬态结果（行动板结果弹窗用） */
export interface ActionResolution {
  action: SimAction;
  success: boolean | null; // null = 无检定
  rate?: number;
  outcome: SimOutcome;
  awakened: TagDef[];
}

/** 结果应用的公共段：数值/峰值/标签/觉醒/连锁事件 */
function applyOutcome(
  st: PlayerState,
  outcome: SimOutcome,
): { axes: PlayerState['axes']; tags: Record<string, number>; awakened: TagDef[]; pendingEvents: string[] } {
  const axes = outcome.deltas ? mergeDeltas(st.axes, outcome.deltas) : st.axes;
  const beforeAwakened = awakenedTagIds(st.tags);
  const tags = { ...st.tags };
  if (outcome.tags) {
    for (const [t, n] of Object.entries(outcome.tags)) tags[t] = (tags[t] ?? 0) + n;
  }
  const awakened = awakenedTagIds(tags)
    .filter((id) => !beforeAwakened.includes(id))
    .map((id) => tagDefs.find((t) => t.id === id)!)
    .filter(Boolean);
  const pendingEvents = [...st.pendingEvents];
  if (outcome.next && !st.eventHistory.includes(outcome.next) && !pendingEvents.includes(outcome.next)) {
    pendingEvents.push(outcome.next);
  }
  return { axes, tags, awakened, pendingEvents };
}

interface EngineStore {
  state: PlayerState | null; // null = 尚未从存档水合
  ready: boolean;
  /** 当前弹出的模拟事件卡（瞬态，不入档） */
  simEvent: SimEvent | null;
  /** 当前事件的结算结果（瞬态） */
  simResolution: SimResolution | null;
  /** 当前行动的结算结果（瞬态） */
  actionResult: ActionResolution | null;
  /** 从当前 SaveAdapter 读档；无档则新建 */
  hydrate: () => Promise<void>;
  /** 卸载状态（登出时用） */
  unload: () => void;
  /** 序章建档（引擎职责）：姓名 / 专业 / flag 局部合并 / 入学特质（一次性生效轴修正） */
  setProfile: (patch: {
    name?: string;
    majorId?: string;
    flag?: Partial<PlayerState['flag']>;
    traits?: string[];
  }) => void;
  /** 过日子：扣 1 行动点抽一张事件卡（进 simEvent 等待抉择） */
  drawSimEvent: () => void;
  /** 事件抉择：检定、结算数值/标签/连锁，产出 simResolution */
  resolveSimEvent: (optionIndex: number) => void;
  /** 关闭事件弹窗（清瞬态） */
  closeSimEvent: () => void;
  /** 关卡结束（onComplete/onEscape 共用）：合并结果、记日志、学期流转、落盘 */
  applyLevelResult: (levelId: string, result: LevelResult) => void;
  /** 行动板行动：扣点 → 适配分支（可含检定）→ 数值/标签/累计/入档/连锁 */
  runSimAction: (action: SimAction) => void;
  /** 关闭行动结果弹窗 */
  closeActionResult: () => void;
  /** 开发调试：跳到指定学期的指定主线关前（不补写档案与能力，正式版随调试按钮一起移除） */
  devJump: (semester: PlayerState['semester'], levelId?: string) => void;
  /** 清档重开 */
  reset: () => Promise<void>;
}

export const useEngine = create<EngineStore>((set) => ({
  state: null,
  ready: false,
  simEvent: null,
  simResolution: null,
  actionResult: null,

  hydrate: async () => {
    const adapter = getSaveAdapter();
    const loaded = adapter ? await adapter.load() : null;
    set({ state: loaded ? migrate(loaded) : freshState(), ready: true });
  },

  unload: () => set({ state: null, ready: false }),

  setProfile: (patch) =>
    set((s) => {
      if (!s.state) return {};
      // 入学特质：记录 id 并一次性应用轴修正（只在未设置过时生效，防重复叠加）
      let axes = s.state.axes;
      let traits = s.state.traits;
      if (patch.traits && s.state.traits.length === 0) {
        traits = patch.traits;
        for (const id of patch.traits) {
          const t = getTrait(id);
          if (t?.deltas) axes = mergeDeltas(axes, t.deltas);
        }
      }
      const next: PlayerState = {
        ...s.state,
        player: {
          name: patch.name ?? s.state.player.name,
          majorId: patch.majorId ?? s.state.player.majorId,
        },
        flag: { ...s.state.flag, ...patch.flag },
        traits,
        axes,
        axesPeak: mergePeak(s.state.axesPeak, axes),
      };
      persistState(next);
      return { state: next };
    }),

  drawSimEvent: () =>
    set((s) => {
      const st = s.state;
      if (!st || s.simEvent || st.actionPoints < 1) return {};
      const ev = drawEvent(st);
      if (!ev) return {};
      const next: PlayerState = { ...st, actionPoints: st.actionPoints - 1 };
      persistState(next);
      return { state: next, simEvent: ev, simResolution: null };
    }),

  resolveSimEvent: (optionIndex) =>
    set((s) => {
      const st = s.state;
      const ev = s.simEvent;
      if (!st || !ev || s.simResolution) return {};
      const opt = ev.options[optionIndex];
      if (!opt) return {};
      // 检定：轴值 vs 难度 → 成败两分支
      let success: boolean | null = null;
      let rate: number | undefined;
      let outcome: SimOutcome | undefined;
      if (opt.check) {
        rate = checkRate(st.axes[opt.check.axis], opt.check.dc);
        success = Math.random() < rate;
        outcome = success ? opt.success : opt.fail;
      } else {
        outcome = opt.result;
      }
      if (!outcome) return {};

      const applied = applyOutcome(st, outcome);
      const next: PlayerState = {
        ...st,
        axes: applied.axes,
        axesPeak: mergePeak(st.axesPeak, applied.axes),
        tags: applied.tags,
        eventHistory: [...st.eventHistory, ev.id],
        pendingEvents: applied.pendingEvents.filter((id) => id !== ev.id),
        log: [
          ...st.log,
          logEntry('quick', 'sim-event', { label: opt.label, result: outcome.text }),
        ],
      };
      persistState(next);
      return {
        state: next,
        simResolution: { optionIndex, success, rate, outcome, awakened: applied.awakened },
      };
    }),

  closeSimEvent: () => set({ simEvent: null, simResolution: null }),

  runSimAction: (action) =>
    set((s) => {
      const st = s.state;
      if (!st || s.actionResult) return {};
      if (st.completedActions.includes(action.id)) return {};
      if (!evalCondition(st, action.requires)) return {};
      const cost = effectiveCost(action.cost, action.costWithAbility, st.abilities);
      if (cost > st.actionPoints) return {};

      // 适配分支：第一个 when 命中者；可选检定出成败
      const branch = pickBranch(st, action);
      let success: boolean | null = null;
      let rate: number | undefined;
      let outcome: SimOutcome | undefined;
      if (branch.check) {
        rate = checkRate(st.axes[branch.check.axis], branch.check.dc);
        success = Math.random() < rate;
        outcome = success ? branch.success : branch.fail;
      } else {
        outcome = branch.result;
      }
      if (!outcome) return {};

      const applied = applyOutcome(st, outcome);
      const next: PlayerState = {
        ...st,
        axes: applied.axes,
        axesPeak: mergePeak(st.axesPeak, applied.axes),
        tags: applied.tags,
        pendingEvents: applied.pendingEvents,
        actionPoints: st.actionPoints - cost,
        completedActions: [...st.completedActions, action.id],
        actionHistory: {
          ...st.actionHistory,
          [action.id]: (st.actionHistory[action.id] ?? 0) + 1,
        },
        archive: outcome.archive
          ? [
              // 同 id 产出（如四六级证书）以最新为准
              ...st.archive.filter((a) => a.id !== outcome.archive!.id),
              {
                ...outcome.archive,
                levelId: `action:${action.id}`,
                semester: st.semester,
                borrowed: false,
              },
            ]
          : st.archive,
        log: [
          ...st.log,
          logEntry('quick', 'quick', { label: action.label, result: outcome.text }),
        ],
      };
      persistState(next);
      return {
        state: next,
        actionResult: { action, success, rate, outcome, awakened: applied.awakened },
      };
    }),

  closeActionResult: () => set({ actionResult: null }),

  applyLevelResult: (levelId, result) =>
    set((s) => {
      const st = s.state;
      if (!st) return {};
      const borrowed = result.archiveItems.some((i) => i.borrowed);
      const newAbilities = result.abilityUnlocks.filter((a) => !st.abilities.includes(a));
      const log: LogEntry[] = [...st.log];

      // 同 id 条目以最新一次为准（开发跳关回放同一关时不产生重复档案）
      const incoming = result.archiveItems.map((item) => ({ ...item, semester: st.semester }));
      const incomingIds = new Set(incoming.map((i) => i.id));

      const mergedAxes = mergeDeltas(st.axes, result.deltas);
      let next: PlayerState = {
        ...st,
        axes: mergedAxes,
        axesPeak: mergePeak(st.axesPeak, mergedAxes),
        abilities: [...st.abilities, ...newAbilities],
        archive: [...st.archive.filter((a) => !incomingIds.has(a.id)), ...incoming],
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
        const rested = { ...next.axes, energy };
        if (to !== 'grad-end') {
          log.push(logEntry('semester', 'semester-start', { semester: semesterName(to) }));
          next = {
            ...next,
            axes: rested,
            axesPeak: mergePeak(next.axesPeak, rested),
            actionPoints: SEMESTER_ACTION_POINTS,
            semester: to,
            completedActions: [],
          };
        } else {
          next = {
            ...next,
            axes: rested,
            axesPeak: mergePeak(next.axesPeak, rested),
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

  devJump: (semester, levelId) =>
    set((s) => {
      const st = s.state;
      if (!st || !isPlayingSemester(semester)) return {};
      const mainline = getBoard(semester).mainline;
      const idx = levelId ? mainline.findIndex((m) => m.id === levelId) : 0;
      const before = mainline.slice(0, Math.max(0, idx)).map((m) => m.id);
      const target = mainline[Math.max(0, idx)];
      const next: PlayerState = {
        ...st,
        semester,
        actionPoints: SEMESTER_ACTION_POINTS,
        completedActions: before,
        log: [
          ...st.log,
          logEntry('system', 'dev-jump', {
            semester: semesterName(semester),
            label: target?.label ?? '',
          }),
        ],
      };
      flushState(next);
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
