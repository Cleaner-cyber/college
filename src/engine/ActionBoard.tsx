/**
 * 行动板（引擎实现）：必修置顶 + 行动列表 + 速结演出 + 结算入口。
 */
import React, { useState } from 'react';
import type { PlayerState, QuickAction } from '@/contracts';
import { boards, quickActions, ui } from './content';
import { useEngine, effectiveCost } from './store';
import { HUD } from '@/components/ui/HUD';
import { Button } from '@/components/ui/Button';

const VISIBLE_AXES = ['academic', 'portfolio', 'expression', 'cash'] as const;

const CostDots: React.FC<{ cost: number; discounted?: boolean }> = ({ cost, discounted }) => (
  <span className={`text-xs ${discounted ? 'text-accent' : 'text-ink-soft'}`}>
    {cost === 0 ? ui.board['free-tag'] : `${'●'.repeat(cost)} ${cost}${ui.board['cost-unit']}`}
  </span>
);

interface CardProps {
  label: string;
  tag?: string;
  cost: number;
  discounted?: boolean;
  completed: boolean;
  disabled: boolean;
  highlight?: boolean;
  onClick: () => void;
}

const ActionCard: React.FC<CardProps> = ({
  label,
  tag,
  cost,
  discounted,
  completed,
  disabled,
  highlight,
  onClick,
}) => (
  <button
    disabled={disabled || completed}
    onClick={onClick}
    className={`w-full rounded-2xl border p-4 text-left transition active:scale-[0.99] ${
      highlight ? 'border-accent bg-accent-soft' : 'border-line bg-card'
    } ${completed ? 'opacity-55' : disabled ? 'opacity-40' : ''}`}
  >
    <div className="flex items-center justify-between">
      <span className="text-[16px] font-medium">{label}</span>
      {completed ? (
        <span className="text-xs text-ink-soft">✓ {ui.board['completed-tag']}</span>
      ) : (
        <CostDots cost={cost} discounted={discounted} />
      )}
    </div>
    <div className="mt-1 flex items-center gap-2 text-xs text-ink-soft">
      {tag && <span>{tag}</span>}
      {discounted && !completed && <span className="text-accent">{ui.board['discount-tag']}</span>}
    </div>
  </button>
);

/** 速结行动结算演出：数值跳动 + 一句话 + 学长点评 */
const QuickResult: React.FC<{ qa: QuickAction; onClose: () => void }> = ({ qa, onClose }) => (
  <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-5">
    <div className="w-full max-w-app rounded-2xl bg-paper p-5 animate-fade-up">
      <div className="flex flex-wrap gap-2">
        {VISIBLE_AXES.filter((a) => (qa.deltas[a] ?? 0) !== 0).map((a) => (
          <span
            key={a}
            className="animate-num-pop rounded-lg bg-accent-soft px-2.5 py-1 text-sm font-semibold text-accent"
          >
            {ui.axes[a]} {qa.deltas[a]! > 0 ? '+' : ''}
            {qa.deltas[a]}
          </span>
        ))}
      </div>
      <p className="mt-4 text-[16px] leading-relaxed">{qa.resultText}</p>
      {qa.senpaiComment && (
        <p className="mt-3 text-sm text-ink-soft">
          <span className="mr-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">
            {ui.board['senpai-prefix']}
          </span>
          {qa.senpaiComment}
        </p>
      )}
      <Button full className="mt-6" onClick={onClose}>
        {ui.common.continue}
      </Button>
    </div>
  </div>
);

interface ActionBoardProps {
  state: Readonly<PlayerState>;
  onEnterLevel: (levelId: string) => void;
  onSettle: () => void;
}

export const ActionBoard: React.FC<ActionBoardProps> = ({ state, onEnterLevel, onSettle }) => {
  const runQuickAction = useEngine((s) => s.runQuickAction);
  const [lastQuick, setLastQuick] = useState<QuickAction | null>(null);

  const board = boards.y1s1;
  const qas = quickActions[board.quickActionsRef] ?? [];
  const requiredDone = state.completedActions.includes(board.required.id);
  const canSettle = state.actionPoints === 0;

  return (
    <div className="min-h-dvh">
      <HUD header={board.header} state={state} />
      <div className="mx-auto flex max-w-app flex-col gap-3 px-4 pb-36 pt-4">
        {/* 必修置顶 */}
        <ActionCard
          label={board.required.label}
          tag={board.required.tag}
          cost={0}
          completed={requiredDone}
          disabled={false}
          highlight={!requiredDone}
          onClick={() => onEnterLevel(board.required.id)}
        />
        {!requiredDone && (
          <p className="py-1 text-center text-sm text-ink-soft">{board.required.lockText}</p>
        )}

        {/* 深度关卡 + 速结行动（完成选课后解锁） */}
        <div className={`flex flex-col gap-3 ${requiredDone ? '' : 'pointer-events-none opacity-35'}`}>
          {board.levels.map((lv) => {
            const cost = effectiveCost(lv.cost, lv.costWithAbility, state.abilities);
            const completed = state.completedActions.includes(lv.id);
            return (
              <ActionCard
                key={lv.id}
                label={lv.label}
                tag={lv.tag}
                cost={cost}
                discounted={cost < lv.cost}
                completed={completed}
                disabled={cost > state.actionPoints}
                onClick={() => onEnterLevel(lv.id)}
              />
            );
          })}
          {qas.map((qa) => {
            const cost = effectiveCost(qa.cost, qa.costWithAbility, state.abilities);
            const completed = state.completedActions.includes(qa.id);
            return (
              <ActionCard
                key={qa.id}
                label={qa.label}
                cost={cost}
                discounted={cost < qa.cost}
                completed={completed}
                disabled={cost > state.actionPoints}
                onClick={() => {
                  runQuickAction(qa);
                  window.setTimeout(() => setLastQuick(qa), 250);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* 结算入口 */}
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 p-4 backdrop-blur">
        <div className="mx-auto max-w-app">
          <Button full disabled={!canSettle} onClick={onSettle}>
            {ui.board['end-semester']}
          </Button>
          {!canSettle && (
            <p className="mt-2 text-center text-xs text-ink-soft">
              {ui.board['end-semester-hint']}
            </p>
          )}
        </div>
      </div>

      {lastQuick && <QuickResult qa={lastQuick} onClose={() => setLastQuick(null)} />}
    </div>
  );
};
