/**
 * 模拟层弹窗组件：
 * - EventModal：学期事件卡（抉择前不可关闭——日子没有跳过键）
 * - ActionResultModal：行动板行动的结算弹窗（适配分支结果 + 检定徽标 + 学长点评）
 */
import React from 'react';
import { createPortal } from 'react-dom';
import type { PlayerState, SimEvent } from '@/contracts';
import type { ActionResolution, SimResolution } from '@/engine/store';
import { interpolate, tagDefs, ui } from '@/engine/content';

const sim = ui.sim as Record<string, string>;

export interface EventOptionView {
  label: string;
  disabled: boolean;
  requireHint?: string;
  checkHint?: string;
}

const DeltaChips: React.FC<{ deltas?: Partial<PlayerState['axes']> }> = ({ deltas }) => {
  if (!deltas) return null;
  const entries = Object.entries(deltas).filter(([, v]) => v !== 0);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span
          key={k}
          className={`rounded-lg px-2 py-0.5 text-[12px] font-medium ${
            (v as number) > 0 ? 'bg-accent-soft text-accent' : 'bg-line text-ink-soft'
          }`}
        >
          {ui.axes[k as keyof PlayerState['axes']]} {(v as number) > 0 ? `+${v}` : v}
        </span>
      ))}
    </div>
  );
};

export const EventModal: React.FC<{
  event: SimEvent;
  options: EventOptionView[];
  resolution: SimResolution | null;
  onPick: (index: number) => void;
  onClose: () => void;
}> = ({ event, options, resolution, onPick, onClose }) => {
  const gainedTags = resolution?.outcome.tags
    ? Object.keys(resolution.outcome.tags).map((id) => tagDefs.find((t) => t.id === id)?.name ?? id)
    : [];

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-paper shadow-pop animate-pop-in">
        {/* 卡头 */}
        <div className="flex items-center gap-2 border-b border-line bg-card px-5 py-3">
          <span className="text-lg">🎲</span>
          <span className="text-[11px] tracking-[0.2em] text-ink-soft">{sim['modal-tag']}</span>
        </div>

        <div className="max-h-[74dvh] overflow-y-auto p-5">
          <p className="text-[15.5px] leading-[1.9]">{event.text}</p>

          {/* 抉择区 */}
          {!resolution && (
            <div className="mt-5 flex flex-col gap-2.5">
              {options.map((o, i) => (
                <button
                  key={i}
                  disabled={o.disabled}
                  onClick={() => onPick(i)}
                  className={`rounded-xl border p-3.5 text-left transition ${
                    o.disabled
                      ? 'border-line bg-card opacity-45'
                      : 'border-line bg-card shadow-soft hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lift'
                  }`}
                >
                  <span className="text-[14.5px] font-medium">{o.label}</span>
                  {(o.checkHint || (o.disabled && o.requireHint)) && (
                    <span className="mt-1 block text-[11.5px] text-ink-soft">
                      {o.disabled ? o.requireHint : o.checkHint}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* 结果区 */}
          {resolution && (
            <div className="mt-5 flex flex-col gap-4 animate-fade-up">
              <div className="rounded-xl border border-line bg-card p-4 shadow-soft">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded bg-line px-2 py-0.5 text-[12px] text-ink-soft">
                    {event.options[resolution.optionIndex]?.label}
                  </span>
                  {resolution.success !== null && (
                    <span
                      className={`rounded px-2 py-0.5 text-[12px] font-medium ${
                        resolution.success ? 'bg-accent text-white' : 'bg-ink text-paper'
                      }`}
                    >
                      {resolution.success ? sim['check-success'] : sim['check-fail']}
                      {resolution.rate !== undefined && ` · ${Math.round(resolution.rate * 100)}%`}
                    </span>
                  )}
                </div>
                <p className="text-[14.5px] leading-[1.9]">{resolution.outcome.text}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <DeltaChips deltas={resolution.outcome.deltas} />
                  {gainedTags.length > 0 && (
                    <span className="rounded-lg bg-paper px-2 py-0.5 text-[12px] text-ink-soft ring-1 ring-line">
                      {sim['tags-gain']}：{gainedTags.join('、')} +1
                    </span>
                  )}
                </div>
              </div>

              {/* 觉醒弹卡 */}
              {resolution.awakened.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-accent/50 bg-accent-soft p-4 shadow-glow animate-pop-in"
                >
                  <div className="text-[11px] tracking-[0.2em] text-accent">
                    ✦ {sim['awaken-title']} · {t.name}
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed">{t.awakenText}</p>
                </div>
              ))}

              <button
                onClick={onClose}
                className="w-full rounded-xl bg-ink py-3 text-[14.5px] font-medium text-paper transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                {sim['close']}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

/** 供页面组装选项视图时复用的插值 */
export const simCopy = (key: string, vars?: Record<string, string | number>): string =>
  vars ? interpolate(sim[key] ?? key, vars) : (sim[key] ?? key);

/** 行动板行动的结算弹窗 */
export const ActionResultModal: React.FC<{
  res: ActionResolution;
  onClose: () => void;
}> = ({ res, onClose }) => {
  const gainedTags = res.outcome.tags
    ? Object.keys(res.outcome.tags).map((id) => tagDefs.find((t) => t.id === id)?.name ?? id)
    : [];
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-paper shadow-pop animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line bg-card px-5 py-3">
          <span className="text-lg">{res.action.icon ?? '📌'}</span>
          <span className="text-[14px] font-medium">{res.action.label}</span>
          {res.success !== null && (
            <span
              className={`ml-auto rounded px-2 py-0.5 text-[12px] font-medium ${
                res.success ? 'bg-accent text-white' : 'bg-ink text-paper'
              }`}
            >
              {res.success ? sim['check-success'] : sim['check-fail']}
              {res.rate !== undefined && ` · ${Math.round(res.rate * 100)}%`}
            </span>
          )}
        </div>
        <div className="max-h-[70dvh] overflow-y-auto p-5">
          <p className="text-[15px] leading-[1.9]">{res.outcome.text}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <DeltaChips deltas={res.outcome.deltas} />
            {gainedTags.length > 0 && (
              <span className="rounded-lg bg-card px-2 py-0.5 text-[12px] text-ink-soft ring-1 ring-line">
                {sim['tags-gain']}：{gainedTags.join('、')} +1
              </span>
            )}
            {res.outcome.archive && (
              <span className="rounded-lg bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent">
                📁 {res.outcome.archive.title}
              </span>
            )}
          </div>
          {res.action.senpaiComment && (
            <p className="mt-4 rounded-xl bg-accent-soft/60 p-3 text-[13px] leading-relaxed text-accent">
              {res.action.senpaiComment}
            </p>
          )}
          {res.awakened.map((t) => (
            <div key={t.id} className="mt-4 rounded-xl border border-accent/50 bg-accent-soft p-4 shadow-glow animate-pop-in">
              <div className="text-[11px] tracking-[0.2em] text-accent">
                ✦ {sim['awaken-title']} · {t.name}
              </div>
              <p className="mt-1.5 text-[14px] leading-relaxed">{t.awakenText}</p>
            </div>
          ))}
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-xl bg-ink py-3 text-[14.5px] font-medium text-paper transition hover:-translate-y-0.5 hover:shadow-lift"
          >
            {sim['action-close']}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
