/**
 * 学期结算：小结（数值动画）→ 档案一览 → 结局卡（flag 对照 + 判词）→ 结尾钩子。
 * 全学期通用；大四结算渲染毕业「身份卡」（#20 结局：flag 对照 + 四轴形状 + N/M + 能力回顾）。
 */
import React, { useEffect, useState } from 'react';
import type { LevelModule, LevelProps, PlayerState, QuickAction } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import {
  ui,
  quickActions,
  getBoard,
  interpolate,
  getFolderSection,
  semesterName,
} from '@/engine/content';
import { nextSemester } from '@/engine/store';
import { Button } from '@/components/ui/Button';
import { Typewriter } from '@/components/ui/Typewriter';

const VISIBLE_AXES = ['academic', 'portfolio', 'expression', 'cash'] as const;
const AXIS_MAX = 8;
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

/** 毕业身份：四轴形状 → 身份键 */
function pickIdentity(state: Readonly<PlayerState>): string {
  const values = VISIBLE_AXES.map((a) => state.axes[a]);
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max <= 1) return 'rest';
  if (max - min <= 2 && min >= 2) return 'balanced';
  return VISIBLE_AXES[values.indexOf(max)];
}

const AxesBars: React.FC<{ state: Readonly<PlayerState>; animate?: boolean; max?: number }> = ({
  state,
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
                width: grown
                  ? `${Math.max(0, Math.min(100, (state.axes[axis] / max) * 100))}%`
                  : '0%',
              }}
            />
          </div>
          <span className="w-5 text-sm font-semibold">{state.axes[axis]}</span>
        </div>
      ))}
    </div>
  );
};

/** 本学期行动回放 */
function replayLines(state: Readonly<PlayerState>): { label: string; text: string }[] {
  const qas: QuickAction[] = quickActions[getBoard(state.semester).quickActionsRef] ?? [];
  return state.completedActions.flatMap((id) => {
    const qa = qas.find((q) => q.id === id);
    if (qa) return [{ label: qa.label, text: qa.resultText }];
    const item = state.archive.find((a) => a.levelId === id);
    return item ? [{ label: item.title, text: '' }] : [];
  });
}

const Recap: React.FC<{ api: FlowAPI; state: Readonly<PlayerState> }> = ({ api, state }) => (
  <div className="flex flex-col gap-6">
    <h1 className="text-2xl font-semibold tracking-wide">
      {interpolate(api.copy('s1-title'), { semester: semesterName(state.semester) })}
    </h1>
    <AxesBars state={state} animate max={isFinal(state) ? 24 : AXIS_MAX} />
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

/** 学期结局卡 / 毕业身份卡 */
const EndingCard: React.FC<{ api: FlowAPI; state: Readonly<PlayerState> }> = ({ api, state }) => {
  const made = state.archive.filter((a) => getFolderSection(a.id) !== 'prompts');
  const total = made.length;
  const own = made.filter((a) => !a.borrowed).length;
  const final = isFinal(state);
  const flagRows: [string, string][] = [
    [api.copy('s3-flag-salary'), state.flag.salaryBand],
    [api.copy('s3-flag-city'), state.flag.city],
    [api.copy('s3-flag-work'), state.flag.workStyle],
    [api.copy('s3-flag-time'), state.flag.offTime],
  ];
  const identity = pickIdentity(state);

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-accent/40 bg-card p-5 shadow-lift">
        <div className="text-xs tracking-widest text-ink-soft">
          {api.copy(final ? 'grad-flag-title' : 's3-flag-title')}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          {flagRows.map(([label, value]) => (
            <div key={label} className="flex items-baseline gap-2">
              <span className="text-[11px] text-ink-soft">{label}</span>
              <span className="text-[14px] font-medium">{value}</span>
            </div>
          ))}
        </div>

        {final && (
          <div className="mt-5 rounded-xl bg-accent-soft/70 p-4 text-center shadow-soft animate-pop-in">
            <div className="text-[11px] tracking-widest text-ink-soft">
              {api.copy('grad-card-title')}
            </div>
            <div className="mt-1.5 text-2xl font-semibold text-accent">
              {api.copy(`grad-id-${identity}`)}
            </div>
            <p className="mt-2 text-[14px] leading-relaxed">{api.copy(`grad-v-${identity}`)}</p>
          </div>
        )}

        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-3 text-xs tracking-widest text-ink-soft">
            {api.copy(final ? 'grad-axes-title' : 's3-axes-title')}
          </div>
          <AxesBars state={state} max={final ? 24 : AXIS_MAX} />
        </div>

        {!final && (
          <p className="mt-5 text-[15px] leading-relaxed text-accent">
            {api.copy(pickVerdictKey(state))}
          </p>
        )}

        {final && state.abilities.length > 0 && (
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-2 text-xs tracking-widest text-ink-soft">
              {api.copy('grad-abilities-title')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {state.abilities.map((a) => (
                <span
                  key={a}
                  className="rounded-lg bg-accent-soft px-2 py-1 text-xs font-medium text-accent"
                >
                  ⚡ {ui.abilities[a] ?? a}
                </span>
              ))}
            </div>
          </div>
        )}

        {total > 0 && (
          <p className="mt-4 text-sm text-ink-soft">
            {interpolate(api.copy(final ? 'grad-made' : 's3-made-count'), { total, own })}
          </p>
        )}
        {final && (
          <p className="mt-2 text-sm font-medium text-accent">{api.copy('grad-flag-echo')}</p>
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
        S3: (api) => <EndingCard api={api} state={state} />,
        S4: (api) => <Hook api={api} state={state} />,
      }}
      onFinish={() => onComplete({ deltas: {}, abilityUnlocks: [], archiveItems: [] })}
    />
  );
};

export const SettlementLevel: LevelModule = { id: 'settlement', Component: SettlementComponent };
