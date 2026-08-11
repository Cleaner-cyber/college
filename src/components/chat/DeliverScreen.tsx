/**
 * 教学关通用交付屏（S10/ESC）与 [问学长] 逃生口。
 * 文案键约定：s10-npc-line / s10-senpai-line / s10-checklist-done / s10-show-prompt /
 * s10-full-prompt / esc-button / esc-confirm-* ；图为可选。
 */
import React, { useState } from 'react';
import type { FlowAPI } from '@/engine/ScreenPlayer';
import { interpolate } from '@/engine/content';
import { Button } from '@/components/ui/Button';

export const DeliverScreen: React.FC<{
  api: FlowAPI;
  total: number;
  img?: string; // 资产路径（已解析）
  escape?: boolean;
  onDone: () => void;
}> = ({ api, total, img, escape = false, onDone }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  return (
    /* custom 屏是裸渲染（没有 ScreenPlayer 的暖纸垫卡），交付屏必须自带纸底，
       否则正文直接排在深色实景上看不清 */
    <div className="fx-paper flex flex-col gap-5 rounded-2xl border border-line-warm bg-parchment/95 p-6 text-ink shadow-lift">
      {img && (
        <img src={img} alt="" className="w-full rounded-xl border border-line-warm shadow-soft animate-fade-up" />
      )}
      {!escape && total > 0 && (
        <p className="text-center text-sm font-medium text-accent">
          {interpolate(api.copy('s10-checklist-done'), { done: api.checked.length, total })}
        </p>
      )}
      <p className="whitespace-pre-wrap text-[16px] leading-relaxed">
        {api.t(api.screen.text ?? '')}
      </p>
      {!escape && (
        <div className="text-[15px] leading-relaxed text-ink-soft">
          {api.copy('s10-npc-line') && <p>{api.copy('s10-npc-line')}</p>}
          {api.copy('s10-senpai-line') && <p>{api.copy('s10-senpai-line')}</p>}
        </div>
      )}
      {!escape && api.copy('s10-show-prompt') && (
        <button
          className="text-left text-sm text-accent underline underline-offset-4"
          onClick={() => setShowPrompt((v) => !v)}
        >
          {api.copy('s10-show-prompt')}
        </button>
      )}
      {showPrompt && (
        <div className="whitespace-pre-wrap rounded-xl border border-line-warm/70 bg-milk/95 p-3.5 text-[13px] leading-relaxed text-ink-soft shadow-soft animate-fade-up">
          {api.copy('s10-full-prompt')}
        </div>
      )}
      <Button full onClick={onDone}>
        {api.nextLabel}
      </Button>
    </div>
  );
};

/** [问学长] 浮动按钮 + 确认弹层（在指定屏显示） */
export const EscapeOverlay: React.FC<{ api: FlowAPI; screens?: string[] }> = ({
  api,
  screens = ['S3'],
}) => {
  const [confirming, setConfirming] = useState(false);
  if (!screens.includes(api.screen.id) || !api.copy('esc-button')) return null;
  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="fixed bottom-5 right-4 z-20 rounded-full border border-cream/20 bg-dusk/80 px-4 py-2 font-display text-sm text-cream shadow-glass backdrop-blur-md transition hover:-translate-y-0.5 hover:border-ember/60 hover:text-ember"
      >
        {api.copy('esc-button')}
      </button>
      {confirming && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl bg-parchment p-6 text-ink shadow-pop animate-pop-in">
            <p className="text-[16px] font-medium">{api.copy('esc-confirm-title')}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                full
                onClick={() => {
                  setConfirming(false);
                  api.goto('ESC');
                }}
              >
                {api.copy('esc-confirm-yes')}
              </Button>
              <Button variant="secondary" full onClick={() => setConfirming(false)}>
                {api.copy('esc-confirm-no')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
