/**
 * 学期结算：小结（数值动画）→ 档案一览 → 简易结局卡（flag 对照 + 判词）→ 结尾钩子。
 * 全部从 PlayerState 与内容 JSON 渲染，可重复进入（y1s1-end 复看）。
 */
import React, { useEffect, useState } from 'react';
import type { LevelModule, LevelProps, PlayerState, QuickAction } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { ui, quickActions, boards, interpolate } from '@/engine/content';
import { Button } from '@/components/ui/Button';
import { Typewriter } from '@/components/ui/Typewriter';

const VISIBLE_AXES = ['academic', 'portfolio', 'expression', 'cash'] as const;
const AXIS_MAX = 8;

function pickVerdictKey(state: Readonly<PlayerState>): string {
  const values = VISIBLE_AXES.map((a) => state.axes[a]);
  const max = Math.max(...values);
  if (max <= 1) {
    return state.axes.energy >= 2 ? 'verdict-rest' : 'verdict-flat';
  }
  const top = VISIBLE_AXES[values.indexOf(max)];
  return `verdict-${top}`;
}

const AxesBars: React.FC<{ state: Readonly<PlayerState>; animate?: boolean }> = ({
  state,
  animate = false,
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
                width: grown ? `${Math.min(100, (state.axes[axis] / AXIS_MAX) * 100)}%` : '0%',
              }}
            />
          </div>
          <span className="w-5 text-sm font-semibold">{state.axes[axis]}</span>
        </div>
      ))}
    </div>
  );
};

/** 本学期行动回放：速结行动取 resultText，关卡取档案条目标题 */
function replayLines(state: Readonly<PlayerState>): { label: string; text: string }[] {
  const qas: QuickAction[] = quickActions[boards.y1s1.quickActionsRef] ?? [];
  return state.completedActions.flatMap((id) => {
    const qa = qas.find((q) => q.id === id);
    if (qa) return [{ label: qa.label, text: qa.resultText }];
    const item = state.archive.find((a) => a.levelId === id);
    return item ? [{ label: item.title, text: '' }] : [];
  });
}

const Recap: React.FC<{ api: FlowAPI; state: Readonly<PlayerState> }> = ({ api, state }) => (
  <div className="flex flex-col gap-6">
    <h1 className="text-2xl font-semibold tracking-wide">{api.copy('s1-title')}</h1>
    <AxesBars state={state} animate />
    <div>
      <div className="mb-2 text-xs tracking-widest text-ink-soft">
        {api.copy('s1-replay-title')}
      </div>
      <ul className="space-y-3">
        {replayLines(state).map((line, i) => (
          <li key={i} className="rounded-xl bg-card p-3">
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
            className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3"
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

const EndingCard: React.FC<{ api: FlowAPI; state: Readonly<PlayerState> }> = ({ api, state }) => {
  const total = state.archive.length;
  const own = state.archive.filter((a) => !a.borrowed).length;
  const flagRows: [string, string][] = [
    [api.copy('s3-flag-salary'), state.flag.salaryBand],
    [api.copy('s3-flag-city'), state.flag.city],
    [api.copy('s3-flag-work'), state.flag.workStyle],
    [api.copy('s3-flag-time'), state.flag.offTime],
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-accent/40 bg-card p-5 shadow-sm">
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
          <div className="mb-3 text-xs tracking-widest text-ink-soft">
            {api.copy('s3-axes-title')}
          </div>
          <AxesBars state={state} />
        </div>
        <p className="mt-5 text-[15px] leading-relaxed text-accent">
          {api.copy(pickVerdictKey(state))}
        </p>
        {total > 0 && (
          <p className="mt-3 text-sm text-ink-soft">
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

const Hook: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [typed, setTyped] = useState(false);
  return (
    <div className="flex flex-col gap-6">
      <Typewriter
        text={api.t(api.screen.text ?? '')}
        onDone={() => setTyped(true)}
        className="text-[17px]"
      />
      {typed && (
        <div className="animate-fade-up">
          <div className="mb-2 text-xs tracking-widest text-ink-soft">
            {api.copy('s4-timeline-title')}
          </div>
          <ul className="space-y-1.5">
            {api
              .copy('s4-timeline')
              .split('｜')
              .map((line) => (
                <li key={line} className="text-sm text-ink-soft/60">
                  ○ {line}
                </li>
              ))}
          </ul>
          <p className="mt-5 text-[15px] text-ink">{api.copy('s4-demo-end')}</p>
          <Button full className="mt-6" onClick={api.advance}>
            {api.nextLabel}
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
        S4: (api) => <Hook api={api} />,
      }}
      onFinish={() => onComplete({ deltas: {}, abilityUnlocks: [], archiveItems: [] })}
    />
  );
};

export const SettlementLevel: LevelModule = { id: 'settlement', Component: SettlementComponent };
