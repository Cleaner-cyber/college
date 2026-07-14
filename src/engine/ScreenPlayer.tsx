/**
 * 通用逐屏播放器：驱动 LevelContent.screens 的状态机。
 * 关卡通过 custom 渲染器覆盖特殊屏（工作台/专业选择等），其余屏走默认渲染。
 */
import React, { useMemo, useState } from 'react';
import type { LevelContent, Screen } from '@/contracts';
import { interpolate } from './content';
import { Button } from '@/components/ui/Button';
import { Typewriter } from '@/components/ui/Typewriter';
import { FakeLoading } from '@/components/ui/FakeLoading';
import { SpeakerTag } from '@/components/ui/SpeakerTag';

export interface FlowAPI {
  screen: Screen;
  vars: Record<string, string>;
  checked: string[];
  setVar: (key: string, value: string) => void;
  check: (id: string) => void;
  goto: (screenId: string) => void;
  advance: () => void;
  copy: (key: string, fallback?: string) => string;
  t: (text: string) => string;
  nextLabel: string;
}

export interface FlowResult {
  vars: Record<string, string>;
  checked: string[];
}

interface ScreenPlayerProps {
  content: LevelContent;
  globalVars: Record<string, string>;
  custom?: Record<string, (api: FlowAPI) => React.ReactNode>;
  onFinish: (result: FlowResult) => void;
  onVarChange?: (key: string, value: string) => void;
  onCheckChange?: (checked: string[]) => void;
  overlay?: (api: FlowAPI) => React.ReactNode;
  defaultNextLabel: string;
  senpaiLabel: string;
}

export const ScreenPlayer: React.FC<ScreenPlayerProps> = ({
  content,
  globalVars,
  custom,
  onFinish,
  onVarChange,
  onCheckChange,
  overlay,
  defaultNextLabel,
  senpaiLabel,
}) => {
  const [currentId, setCurrentId] = useState(content.screens[0].id);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<string[]>([]);
  const [loadedScreens, setLoadedScreens] = useState<string[]>([]);
  const [typingDone, setTypingDone] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const screen = useMemo(
    () => content.screens.find((s) => s.id === currentId) ?? content.screens[0],
    [content, currentId],
  );

  const allVars = { ...globalVars, ...vars };

  const t = (text: string) => interpolate(text, allVars);
  const copy = (key: string, fallback = '') => {
    const raw = content.copy[key];
    return raw !== undefined ? t(raw) : fallback;
  };

  const setVar = (key: string, value: string) => {
    setVars((v) => ({ ...v, [key]: value }));
    onVarChange?.(key, value);
  };

  const check = (id: string) => {
    setChecked((c) => {
      if (c.includes(id)) return c;
      const next = [...c, id];
      onCheckChange?.(next);
      return next;
    });
  };

  const enter = (id: string) => {
    setCurrentId(id);
    setTypingDone(false);
    setInputValue('');
    window.scrollTo(0, 0);
  };

  const goto = (screenId: string) => {
    if (screenId === 'end') {
      onFinish({ vars, checked });
    } else {
      enter(screenId);
    }
  };

  const advance = () => goto(screen.next ?? 'end');

  const api: FlowAPI = {
    screen,
    vars: allVars,
    checked,
    setVar,
    check,
    goto,
    advance,
    copy,
    t,
    nextLabel: copy(`next-${screen.id}`, defaultNextLabel),
  };

  // 假生成等待：先播 loading，再进正文
  const needsLoading =
    screen.effects?.fakeLoading !== undefined && !loadedScreens.includes(screen.id);

  const renderAsset = () => {
    const ref = screen.effects?.showAsset;
    if (!ref) return null;
    const key = t(ref);
    const src = content.presetAssets?.[key];
    if (!src) return null;
    return (
      <img
        src={src}
        alt={key}
        className="mx-auto w-full max-w-[300px] rounded-xl border border-line shadow-sm animate-fade-up"
      />
    );
  };

  const renderDefault = () => {
    const useTypewriter = screen.effects?.typewriter === true;
    const body = screen.text ? (
      useTypewriter ? (
        <Typewriter
          text={t(screen.text)}
          onDone={() => setTypingDone(true)}
          className="text-[17px]"
        />
      ) : (
        <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{t(screen.text)}</p>
      )
    ) : null;
    const ready = !useTypewriter || typingDone;

    switch (screen.type) {
      case 'dialogue':
        return (
          <div>
            {screen.speaker && (
              <SpeakerTag
                speaker={screen.speaker}
                npcName={screen.npcName}
                senpaiLabel={senpaiLabel}
              />
            )}
            {body}
            <div className={`mt-8 transition-opacity ${ready ? 'opacity-100' : 'opacity-0'}`}>
              <Button full onClick={advance} disabled={!ready}>
                {api.nextLabel}
              </Button>
            </div>
          </div>
        );
      case 'input': {
        const confirmLabel = copy(`confirm-${screen.id}`, defaultNextLabel);
        const canConfirm = inputValue.trim().length > 0;
        return (
          <div>
            {body}
            <input
              value={inputValue}
              maxLength={8}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={screen.placeholder ? t(screen.placeholder) : ''}
              className="mt-6 w-full rounded-xl border border-line bg-card px-4 py-3 text-[17px] outline-none focus:border-accent"
            />
            <div className="mt-8">
              <Button
                full
                disabled={!canConfirm}
                onClick={() => {
                  if (screen.inputKey) setVar(screen.inputKey, inputValue.trim());
                  advance();
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        );
      }
      case 'choice':
        return (
          <div>
            {body}
            <div className="mt-6 flex flex-col gap-3">
              {(screen.choices ?? []).map((c) => (
                <Button
                  key={c.id}
                  variant="secondary"
                  full
                  onClick={() => {
                    if (c.setVar) setVar(c.setVar.key, c.setVar.value);
                    if (c.checkItem) check(c.checkItem);
                    goto(c.next);
                  }}
                >
                  {t(c.label)}
                </Button>
              ))}
            </div>
          </div>
        );
      case 'reveal':
      case 'deliver':
      case 'workbench':
        return (
          <div className="flex flex-col gap-6">
            {renderAsset()}
            {screen.text &&
              (useTypewriter ? (
                <Typewriter
                  text={t(screen.text)}
                  onDone={() => setTypingDone(true)}
                  className="text-[17px]"
                />
              ) : (
                <p className="whitespace-pre-wrap text-[17px] leading-relaxed">{t(screen.text)}</p>
              ))}
            <div className={`transition-opacity ${ready ? 'opacity-100' : 'opacity-0'}`}>
              <Button full onClick={advance} disabled={!ready}>
                {api.nextLabel}
              </Button>
            </div>
          </div>
        );
    }
  };

  const customRenderer = custom?.[screen.id];

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-app flex-col px-5 pb-10 pt-6">
      <div className="mb-6 text-xs tracking-widest text-ink-soft">{content.title}</div>
      {needsLoading ? (
        <FakeLoading
          key={screen.id}
          ms={screen.effects!.fakeLoading!.ms}
          tips={screen.effects!.fakeLoading!.tips.map(t)}
          onDone={() => {
            // 纯等待屏（无正文/无资产/无自定义渲染）：加载完自动进入下一屏
            const autoAdvance =
              !screen.text && !screen.effects?.showAsset && !custom?.[screen.id];
            setLoadedScreens((l) => [...l, screen.id]);
            if (autoAdvance) advance();
          }}
        />
      ) : (
        <div key={screen.id} className="flex-1 animate-fade-up">
          {customRenderer ? customRenderer(api) : renderDefault()}
        </div>
      )}
      {overlay?.(api)}
    </div>
  );
};
