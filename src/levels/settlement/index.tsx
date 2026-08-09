/**
 * 学期结算：小结（数值动画 + 本学期高光）→ 档案一览 → 结局卡 → 结尾钩子。
 * 大四/毕业复看渲染「毕业档案」长卡（docs/08 P2）：
 * 总评档位 + 四年形状（峰值）+ 时间线 + 人设画像 + flag 对照 + 身份卡 + 差一点提示。
 */
import React, { useEffect, useState } from 'react';
import type { LevelModule, LevelProps, PlayerState } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import {
  ui,
  getMajor,
  getSimAction,
  getTrait,
  interpolate,
  getFolderSection,
  semesterName,
} from '@/engine/content';
import { nextSemester, projectSettlement } from '@/engine/store';
import { awakenedTagIds, cumulativeGpa, semesterGpa, tagDef } from '@/engine/sim';
import { pathResult } from '@/engine/path';
import {
  axisComment,
  computeSum,
  currentHighlight,
  findAlmost,
  flagResults,
  pickEnding,
  semesterStories,
  sumTier,
} from '@/engine/ending';
import { Button } from '@/components/ui/Button';
import { Typewriter } from '@/components/ui/Typewriter';

const VISIBLE_AXES = ['academic', 'portfolio', 'expression', 'cash'] as const;
const AXIS_MAX = 8;
const PEAK_MAX = 12; // 毕业档案的峰值刻度（主线满贯约 8，选修叠加后 10+ 常见；超出封顶）
const home = ui.home as Record<string, string>;

/** 大四（或毕业复看）走毕业结局 */
function isFinal(state: Readonly<PlayerState>): boolean {
  return state.semester === 'y4' || state.semester === 'grad-end';
}

function pickVerdictKey(state: Readonly<PlayerState>): string {
  const values = VISIBLE_AXES.map((a) => state.axes[a]);
  const max = Math.max(...values);
  if (max <= 1) {
    return state.axes.energy >= 2 ? 'verdict-rest' : 'verdict-flat';
  }
  const top = VISIBLE_AXES[values.indexOf(max)];
  return `verdict-${top}`;
}

const AxesBars: React.FC<{ axes: Readonly<PlayerState['axes']>; animate?: boolean; max?: number }> = ({
  axes,
  animate = false,
  max = AXIS_MAX,
}) => {
  const [grown, setGrown] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const t = window.setTimeout(() => setGrown(true), 150);
    return () => window.clearTimeout(t);
  }, [animate]);
  return (
    <div className="flex flex-col gap-2.5">
      {VISIBLE_AXES.map((axis) => (
        <div key={axis} className="flex items-center gap-3">
          <span className="w-8 text-right text-sm text-ink-soft">{ui.axes[axis]}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out"
              style={{
                width: grown ? `${Math.max(0, Math.min(100, (axes[axis] / max) * 100))}%` : '0%',
              }}
            />
          </div>
          <span className="w-5 text-sm font-semibold">{axes[axis]}</span>
        </div>
      ))}
    </div>
  );
};

/** 本学期行动回放（行动板行动的结果文案从日志里取——同一行动的结果分支因人而异） */
function replayLines(state: Readonly<PlayerState>): { label: string; text: string }[] {
  return state.completedActions.flatMap((id) => {
    const action = getSimAction(id);
    if (action) {
      const logLine = [...state.log]
        .reverse()
        .find((l) => l.type === 'quick' && l.text.startsWith(`${action.label}：`));
      return [{ label: action.label, text: logLine ? logLine.text.slice(action.label.length + 1) : '' }];
    }
    const item = state.archive.find((a) => a.levelId === id);
    return item ? [{ label: item.title, text: '' }] : [];
  });
}

/** 本学期绩点：已落账就用落账值，否则用同一公式现算。
 * 结算页渲染早于 applyLevelResult('settlement') 落账，不现算的话当期绩点会缺席。 */
function currentSemesterGpa(state: Readonly<PlayerState>): number {
  return (
    state.gpaHistory[state.semester] ??
    semesterGpa(state.axes.academic - state.semesterAcademicStart, state.axes.energy)
  );
}

const Recap: React.FC<{ api: FlowAPI; state: Readonly<PlayerState> }> = ({ api, state }) => {
  const highlight = currentHighlight(state);
  // 学期绩点预告（正式入档在结算落账时；这里用同一公式先亮出来）
  const gpa = currentSemesterGpa(state);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-wide">
          {interpolate(api.copy('s1-title'), { semester: semesterName(state.semester) })}
        </h1>
        <span className="rounded-xl bg-accent-soft px-3 py-1.5 text-sm font-semibold tabular-nums text-accent">
          {interpolate(api.copy('s1-gpa'), { gpa: gpa.toFixed(2) })}
        </span>
      </div>
      <AxesBars axes={state.axes} animate max={AXIS_MAX} />
      {highlight && !isFinal(state) && (
        <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-3">
          <div className="mb-1 text-[11px] tracking-widest text-ink-soft">
            {api.copy('s1-highlight-title')}
          </div>
          <p className="text-[13px] leading-relaxed">{highlight}</p>
        </div>
      )}
      <div>
        <div className="mb-2 text-xs tracking-widest text-ink-soft">
          {api.copy('s1-replay-title')}
        </div>
        <ul className="space-y-3">
          {replayLines(state).map((line, i) => (
            <li key={i} className="rounded-xl border border-line/70 bg-card p-3 shadow-soft">
              <div className="text-sm font-medium">{line.label}</div>
              {line.text && (
                <div className="mt-1 text-[13px] leading-relaxed text-ink-soft">{line.text}</div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <Button full onClick={api.advance}>
        {api.nextLabel}
      </Button>
    </div>
  );
};

const Folder: React.FC<{ api: FlowAPI; state: Readonly<PlayerState> }> = ({ api, state }) => (
  <div className="flex flex-col gap-5">
    <h1 className="text-xl font-semibold">{api.copy('s2-title')}</h1>
    {state.archive.length === 0 ? (
      <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
        {api.copy('s2-empty')}
      </p>
    ) : (
      <ul className="space-y-2">
        {state.archive.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-xl border border-line/70 bg-card px-4 py-3 shadow-soft"
          >
            <span className="text-[15px]">📁 {item.title}</span>
            {item.borrowed && (
              <span className="rounded bg-line px-1.5 py-0.5 text-[11px] text-ink-soft">
                {api.copy('borrowed-tag')}
              </span>
            )}
          </li>
        ))}
      </ul>
    )}
    <Button full onClick={api.advance}>
      {api.nextLabel}
    </Button>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="mb-2 text-xs tracking-widest text-ink-soft">{children}</div>
);

/** 毕业档案长卡（P2）：总评 → 形状 → 时间线 → 人设 → flag 对照 → 身份卡 → 差一点 → 产出与能力 */
const GradReport: React.FC<{ api: FlowAPI; state: Readonly<PlayerState> }> = ({
  api,
  state: rawState,
}) => {
  // 结算落账发生在玩家点完最后一屏之后；这里先按同一套规则投影，
  // 否则毕业卡展示的是结算前的旧账（大四绩点、剩余行动点转的精力都不在里面），
  // 会出现"看到的结局"和"记录下来的结局"是两张卡。
  const state = projectSettlement(rawState);
  const sum = computeSum(state);
  const tier = sumTier(sum);
  const stories = semesterStories(state);
  const awakened = awakenedTagIds(state.tags);
  const flags = flagResults(state);
  const score = flags.filter((f) => f.done).length;
  const ending = pickEnding(state);
  const almost = findAlmost(state, ending);
  const path = pathResult(state);
  // 含大四本身：漏算的话毕业卡上印的均绩会比落账后的 HUD 少一档，两处数字打架
  const gpa = cumulativeGpa(state);
  const made = state.archive.filter((a) => getFolderSection(a.id) !== 'prompts');
  const own = made.filter((a) => !a.borrowed).length;
  const topAxis = VISIBLE_AXES.reduce((best, a) => (state.axesPeak[a] > state.axesPeak[best] ? a : best), VISIBLE_AXES[0]);
  const flagLabels: Record<string, string> = {
    salaryBand: api.copy('s3-flag-salary'),
    city: api.copy('s3-flag-city'),
    workStyle: api.copy('s3-flag-work'),
    offTime: api.copy('s3-flag-time'),
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-2xl border border-accent/40 bg-card shadow-lift">
        {/* 封面：毕业典礼散场（装饰图，加载失败自动隐藏） */}
        <img
          src="/assets/bg-grad.jpg"
          alt=""
          className="h-40 w-full object-cover"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
        <div className="p-5">
        {/* 抬头：姓名 · 专业 · 总评档位 */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs tracking-widest text-ink-soft">{api.copy('grad-report-title')}</div>
            <div className="mt-1 text-lg font-semibold">
              {interpolate(api.copy('grad-report-sub'), {
                playerName: state.player.name,
                majorName: getMajor(state.player.majorId).name,
              })}
            </div>
          </div>
          <div className="shrink-0 rounded-xl bg-accent-soft px-3 py-2 text-center">
            <div className="text-2xl font-bold leading-none text-accent">{tier.tier}</div>
            <div className="mt-1 text-[11px] text-ink-soft">{api.copy('grad-sum-title')}</div>
          </div>
        </div>
        <p className="mt-2 text-[14px] font-medium text-accent">{tier.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{tier.text}</p>
        {gpa !== null && (
          <p className="mt-2 text-[13px] text-ink-soft">
            {interpolate(api.copy('grad-gpa'), { gpa: gpa.toFixed(2) })}
          </p>
        )}

        {/* 四年的形状（各轴历史最高） */}
        <div className="mt-5 border-t border-line pt-4">
          <SectionTitle>{api.copy('grad-axes-title')}</SectionTitle>
          <AxesBars axes={state.axesPeak} animate max={PEAK_MAX} />
          <div className="mt-3 space-y-1 text-[13px] leading-relaxed text-ink-soft">
            <p>{axisComment(topAxis, state.axesPeak[topAxis])}</p>
            <p>{axisComment('energy', state.axesPeak.energy)}</p>
          </div>
        </div>

        {/* 四年时间线 */}
        {stories.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <SectionTitle>{api.copy('grad-timeline-title')}</SectionTitle>
            <ul className="space-y-2">
              {stories.map((s) => (
                <li key={s.semester} className="flex gap-3">
                  <span className="w-12 shrink-0 pt-px text-[12px] font-medium text-ink-soft">{s.name}</span>
                  <span className="min-w-0 flex-1 text-[13px] leading-relaxed">
                    {s.highlight || api.copy('grad-timeline-quiet')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 人设画像：入学特质 + 四年觉醒标签 */}
        <div className="mt-5 border-t border-line pt-4">
          <SectionTitle>{api.copy('grad-persona-title')}</SectionTitle>
          <div className="flex flex-wrap gap-1.5">
            {state.traits.map((id) => (
              <span key={id} className="rounded-lg border border-line bg-paper px-2 py-1 text-xs">
                {getTrait(id)?.name ?? id}
              </span>
            ))}
            {awakened.map((id) => (
              <span key={id} className="rounded-lg bg-accent-soft px-2 py-1 text-xs font-medium text-accent">
                ★ {tagDef(id)?.name ?? id}
              </span>
            ))}
          </div>
          {awakened.length === 0 && (
            <p className="mt-2 text-[13px] text-ink-soft">{api.copy('grad-persona-none')}</p>
          )}
        </div>

        {/* flag 对照：入学目标 vs 四年实绩 */}
        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <SectionTitle>{api.copy('grad-flag-title')}</SectionTitle>
            <span className="text-[12px] font-medium text-accent">
              {interpolate(api.copy('grad-flag-score'), { score })}
            </span>
          </div>
          <ul className="space-y-2.5">
            {flags.map((f) => (
              <li key={f.field} className="flex gap-2.5">
                <span className={`pt-px text-[14px] ${f.done ? 'text-accent' : 'text-ink-soft/50'}`}>
                  {f.done ? '✓' : '✗'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px]">
                    <span className="text-ink-soft">{flagLabels[f.field]}</span>
                    <span className="ml-2 font-medium">{f.value}</span>
                  </div>
                  {f.text && (
                    <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{f.text}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* 出路判定（v2.6）：开局目标 vs 四年真实作为 → 走通概率 + 逐条解释（含无用功点破） */}
        {path && (
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle>{api.copy('grad-path-title')}</SectionTitle>
              <span className="text-[13px] font-medium">
                {path.def.icon} {path.def.name}
              </span>
            </div>
            <div className="flex items-center gap-4 rounded-xl bg-accent-soft/50 p-4">
              <div className="text-center">
                <div className="text-3xl font-bold tabular-nums text-accent">{path.prob}%</div>
                <div className="mt-0.5 text-[11px] text-ink-soft">{api.copy('grad-path-prob-label')}</div>
              </div>
              <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink-soft">
                {api.copy(
                  path.prob >= 70
                    ? 'grad-path-note-high'
                    : path.prob >= 40
                      ? 'grad-path-note-mid'
                      : 'grad-path-note-low',
                )}
              </p>
            </div>
            <ul className="mt-3 space-y-2">
              {path.factors.map((f) => (
                <li key={f.label} className="flex gap-2.5">
                  <span
                    className={`w-9 shrink-0 pt-px text-right text-[13px] font-semibold tabular-nums ${
                      f.points > 0 ? 'text-accent' : 'text-ink-soft'
                    }`}
                  >
                    {f.points > 0 ? `+${f.points}` : f.points}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium">{f.label}</div>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft">{f.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 身份卡 */}
        <div className="mt-5 rounded-xl bg-accent-soft/70 p-4 text-center shadow-soft animate-pop-in">
          <div className="text-[11px] tracking-widest text-ink-soft">{api.copy('grad-card-title')}</div>
          <div className="mt-1.5 text-2xl font-semibold text-accent">{ending.title}</div>
          <p className="mt-2 text-[14px] leading-relaxed">{ending.verdict}</p>
        </div>

        {/* 差一点 */}
        {almost && (
          <div className="mt-3 rounded-xl border border-dashed border-line p-3">
            <div className="text-[11px] tracking-widest text-ink-soft">{api.copy('grad-almost-title')}</div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
              {interpolate(api.copy('grad-almost-line'), { title: almost.title })} {almost.almostHint}
            </p>
          </div>
        )}

        {/* 产出与能力 */}
        {state.abilities.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <SectionTitle>{api.copy('grad-abilities-title')}</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {state.abilities.map((a) => (
                <span key={a} className="rounded-lg bg-accent-soft px-2 py-1 text-xs font-medium text-accent">
                  ⚡ {ui.abilities[a] ?? a}
                </span>
              ))}
            </div>
          </div>
        )}
        {made.length > 0 && (
          <p className="mt-4 text-sm text-ink-soft">
            {interpolate(api.copy('grad-made'), { total: made.length, own })}
          </p>
        )}
        <p className="mt-2 text-sm font-medium text-accent">{api.copy('grad-flag-echo')}</p>
        </div>
      </div>
      <Button full onClick={api.advance}>
        {api.nextLabel}
      </Button>
    </div>
  );
};

/** 学期结局卡（非毕业学期） */
const SemesterCard: React.FC<{ api: FlowAPI; state: Readonly<PlayerState> }> = ({ api, state }) => {
  const made = state.archive.filter((a) => getFolderSection(a.id) !== 'prompts');
  const total = made.length;
  const own = made.filter((a) => !a.borrowed).length;
  const flagRows: [string, string][] = [
    [api.copy('s3-flag-salary'), state.flag.salaryBand],
    [api.copy('s3-flag-city'), state.flag.city],
    [api.copy('s3-flag-work'), state.flag.workStyle],
    [api.copy('s3-flag-time'), state.flag.offTime],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-accent/40 bg-card p-5 shadow-lift">
        <div className="text-xs tracking-widest text-ink-soft">{api.copy('s3-flag-title')}</div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          {flagRows.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-2">
              <span className="text-[11px] text-ink-soft">{label}</span>
              <span className="text-[14px] font-medium">{value}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <SectionTitle>{api.copy('s3-axes-title')}</SectionTitle>
          <AxesBars axes={state.axes} max={AXIS_MAX} />
        </div>

        <p className="mt-5 text-[15px] leading-relaxed text-accent">{api.copy(pickVerdictKey(state))}</p>

        {total > 0 && (
          <p className="mt-4 text-sm text-ink-soft">
            {interpolate(api.copy('s3-made-count'), { total, own })}
          </p>
        )}
      </div>
      <Button full onClick={api.advance}>
        {api.nextLabel}
      </Button>
    </div>
  );
};

const Hook: React.FC<{ api: FlowAPI; state: Readonly<PlayerState> }> = ({ api, state }) => {
  const [typed, setTyped] = useState(false);
  const final = isFinal(state);
  const sem = semesterName(state.semester);
  const line = final
    ? api.copy('s4-line-final')
    : interpolate(api.copy('s4-line'), { semester: sem });
  // 剩余时间轴：从 Home 的全局时间轴推剩余站点
  const timeline = home['timeline'].split('｜');
  const idxMap: Record<string, number> = {
    y1s1: 1, y1s2: 2, y2s1: 3, y2s2: 4, y3s1: 5, y3s2: 6, y4: 7, 'grad-end': 8,
  };
  const remaining = timeline.slice((idxMap[state.semester] ?? 7) + 1);

  return (
    <div className="flex flex-col gap-6">
      <Typewriter text={line} onDone={() => setTyped(true)} className="text-[17px]" />
      {typed && (
        <div className="animate-fade-up">
          {!final && remaining.length > 0 && (
            <>
              <div className="mb-2 text-xs tracking-widest text-ink-soft">
                {api.copy('s4-timeline-title')}
              </div>
              <ul className="space-y-1.5">
                {remaining.map((t) => (
                  <li key={t} className="text-sm text-ink-soft/60">
                    ○ {t}
                  </li>
                ))}
              </ul>
            </>
          )}
          {final && <p className="text-[15px] text-ink">{api.copy('s4-final-note')}</p>}
          <Button full className="mt-6" onClick={api.advance}>
            {final || state.semester === 'grad-end'
              ? api.nextLabel
              : interpolate(api.copy('s4-next-semester'), {
                  next: semesterName(nextSemester(state.semester)),
                })}
          </Button>
        </div>
      )}
    </div>
  );
};

const SettlementComponent: React.FC<LevelProps> = ({ state, content, onComplete }) => {
  return (
    <ScreenPlayer
      content={content}
      globalVars={{ playerName: state.player.name }}
      defaultNextLabel={ui.common.continue}
      senpaiLabel={ui.board['senpai-prefix']}
      custom={{
        S1: (api) => <Recap api={api} state={state} />,
        S2: (api) => <Folder api={api} state={state} />,
        S3: (api) =>
          isFinal(state) ? <GradReport api={api} state={state} /> : <SemesterCard api={api} state={state} />,
        S4: (api) => <Hook api={api} state={state} />,
      }}
      onFinish={() => onComplete({ deltas: {}, abilityUnlocks: [], archiveItems: [] })}
    />
  );
};

export const SettlementLevel: LevelModule = { id: 'settlement', Component: SettlementComponent };
