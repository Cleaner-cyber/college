/**
 * 通用逐屏播放器：驱动 LevelContent.screens 的状态机。
 * 关卡通过 custom 渲染器覆盖特殊屏（工作台/专业选择等），其余屏走默认渲染。
 */
import React, { useMemo, useState } from 'react';
import type { LevelContent, Screen } from '@/contracts';
import { interpolate, ui } from './content';
import { VN_HINT_KEY } from '@/components/ui/Tour';
import { Button } from '@/components/ui/Button';
import { Typewriter } from '@/components/ui/Typewriter';
import { FakeLoading } from '@/components/ui/FakeLoading';
import { SpeakerTag } from '@/components/ui/SpeakerTag';

/** VN 场景底图：presetAssets 若指向占位 .svg，则先试同名 .jpg 真图（生图后同名放入即替换，不改内容 JSON） */
const SceneBg: React.FC<{ src?: string }> = ({ src }) => {
  const preferred = src?.endsWith('.svg') ? src.replace(/\.svg$/, '.jpg') : src;
  const [cur, setCur] = useState(preferred);
  React.useEffect(() => setCur(preferred), [preferred]);
  if (!cur) return null;
  return (
    <img
      src={cur}
      onError={() => src && cur !== src && setCur(src)}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
};

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
  /** 需要宽版面的屏 id（如 AI 对话工作台），其余屏保持窄栏叙事 */
  wideScreens?: string[];
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
  wideScreens = [],
}) => {
  const [currentId, setCurrentId] = useState(content.screens[0].id);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<string[]>([]);
  const [loadedScreens, setLoadedScreens] = useState<string[]>([]);
  const [typingDone, setTypingDone] = useState(false);
  const [forceFull, setForceFull] = useState(false); // 场景点击跳过打字机
  const [inputValue, setInputValue] = useState('');
  // 新手提示：第一次玩 VN 时提示「单击继续」，推进一次后不再出现
  const [showVnHint, setShowVnHint] = useState(() => {
    try {
      return !localStorage.getItem(VN_HINT_KEY);
    } catch {
      return false;
    }
  });

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
    setForceFull(false);
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
        className="mx-auto w-full max-w-[300px] rounded-xl border border-line shadow-soft animate-fade-up"
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
      case 'dialogue': {
        const isSystem = screen.speaker === 'system' || !screen.speaker;
        return (
          <div>
            {screen.speaker && (
              <SpeakerTag
                speaker={screen.speaker}
                npcName={screen.npcName}
                senpaiLabel={senpaiLabel}
              />
            )}
            {isSystem ? (
              <div className="py-4 text-left">{body}</div>
            ) : (
              <div className="ml-[52px] rounded-2xl rounded-tl-md border border-line-warm bg-parchment/70 p-4 shadow-soft">
                {body}
              </div>
            )}
            <div className={`mt-8 transition-opacity ${ready ? 'opacity-100' : 'opacity-0'}`}>
              <Button full onClick={advance} disabled={!ready}>
                {api.nextLabel}
              </Button>
            </div>
          </div>
        );
      }
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

  // 视觉小说模式：copy 里 scene-{屏 id} / sprite-{屏 id} 指向 presetAssets 的场景与立绘
  const sceneSrc = content.presetAssets?.[content.copy[`scene-${screen.id}`] ?? ''];
  const spriteSrc = content.presetAssets?.[content.copy[`sprite-${screen.id}`] ?? ''];
  const isVN =
    !!sceneSrc &&
    !customRenderer &&
    (screen.type === 'dialogue' || screen.type === 'choice' || screen.type === 'input');

  const renderVN = () => {
    const useTypewriter = screen.effects?.typewriter === true;
    const ready = !useTypewriter || typingDone || forceFull;
    const isSystem = !screen.speaker || screen.speaker === 'system';
    const name = screen.speaker === 'senpai' ? senpaiLabel : (screen.npcName ?? '');
    const text = screen.text ? t(screen.text) : '';
    const confirmLabel = copy(`confirm-${screen.id}`, defaultNextLabel);
    const canConfirm = inputValue.trim().length > 0;

    const handleSceneClick = () => {
      if (!ready) {
        setForceFull(true);
        setTypingDone(true);
      } else if (screen.type === 'dialogue') {
        if (showVnHint) {
          try {
            localStorage.setItem(VN_HINT_KEY, '1');
          } catch {
            /* ignore */
          }
          setShowVnHint(false);
        }
        advance();
      }
    };

    return (
      <div
        onClick={handleSceneClick}
        className="relative h-[min(72dvh,660px)] w-full select-none overflow-hidden rounded-2xl border border-line shadow-lift"
      >
        {/* 场景：真图 .jpg 优先（生图后同名放 public/assets 即生效），缺省回退占位 .svg */}
        <SceneBg src={sceneSrc} />
        {/* 底部渐变压暗：托住对话盒，突出立绘 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-ink/25 to-transparent" />
        {/* 新手提示：单击继续 */}
        {showVnHint && screen.type === 'dialogue' && (
          <span className="absolute right-4 top-4 z-10 animate-pulse rounded-full bg-ink/60 px-3.5 py-1.5 text-xs text-paper">
            👆 {(ui.hints as Record<string, string>)['vn-click']}
          </span>
        )}
        {/* 立绘：学长在右，NPC 在左 */}
        {spriteSrc && (
          <img
            src={spriteSrc}
            alt=""
            className={`absolute bottom-0 h-[76%] animate-fade-up ${
              screen.speaker === 'npc' ? 'left-[6%]' : 'right-[6%]'
            }`}
          />
        )}
        {/* 选项浮层 */}
        {screen.type === 'choice' && ready && (
          <div className="absolute inset-x-0 bottom-40 top-0 flex items-center justify-center">
            <div className="flex w-full max-w-md flex-col gap-2.5 px-8">
              {(screen.choices ?? []).map((c, i) => (
                <button
                  key={c.id}
                  style={{ animationDelay: `${i * 70}ms` }}
                  className="animate-fade-up rounded-xl border border-line-warm/70 bg-milk/85 px-5 py-3 text-[15px] shadow-soft backdrop-blur-md transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lift"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (c.setVar) setVar(c.setVar.key, c.setVar.value);
                    if (c.checkItem) check(c.checkItem);
                    goto(c.next);
                  }}
                >
                  {t(c.label)}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* 底部对话盒 */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="mx-auto max-w-3xl">
            {!isSystem && (
              <span
                className={`relative z-10 -mb-px ml-4 inline-block rounded-t-xl border border-b-0 border-line/60 px-4 py-1.5 text-sm font-semibold tracking-wide ${
                  screen.speaker === 'senpai' ? 'bg-accent text-white' : 'bg-dusk-2 text-cream'
                }`}
              >
                {name}
              </span>
            )}
            <div className="relative min-h-[104px] rounded-2xl border border-line-warm/60 bg-milk/90 px-7 py-5 shadow-pop backdrop-blur-md">
              {text &&
                (useTypewriter && !forceFull ? (
                  <Typewriter
                    text={text}
                    onDone={() => setTypingDone(true)}
                    className="text-left text-[16px] leading-[1.9]"
                  />
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {text.split('\n').map((line, i) => (
                      <p key={i} className="text-left text-[16px] leading-[1.8]">
                        {line}
                      </p>
                    ))}
                  </div>
                ))}
              {screen.type === 'input' && (
                <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    value={inputValue}
                    maxLength={8}
                    autoFocus
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canConfirm) {
                        if (screen.inputKey) setVar(screen.inputKey, inputValue.trim());
                        advance();
                      }
                    }}
                    placeholder={screen.placeholder ? t(screen.placeholder) : ''}
                    className="flex-1 rounded-xl border border-line bg-card px-4 py-2.5 text-[16px] outline-none focus:border-accent"
                  />
                  <Button
                    disabled={!canConfirm}
                    onClick={() => {
                      if (screen.inputKey) setVar(screen.inputKey, inputValue.trim());
                      advance();
                    }}
                  >
                    {confirmLabel}
                  </Button>
                </div>
              )}
              {screen.type === 'dialogue' && ready && (
                <span className="absolute bottom-2.5 right-4 animate-bounce text-accent">▾</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const isWide = wideScreens.includes(screen.id) || isVN;
  return (
    <div
      className={`mx-auto flex w-full flex-col px-6 pb-16 pt-10 ${isWide ? 'max-w-5xl' : 'max-w-xl'}`}
    >
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
          {customRenderer ? (
            customRenderer(api)
          ) : isVN ? (
            renderVN()
          ) : (
            /* 默认叙事屏：垫一张暖纸卡——关卡页是深色实景底，正文不能裸排在暗底上 */
            <div className="rounded-2xl border border-line-warm bg-milk/95 p-6 shadow-lift backdrop-blur-sm">
              {renderDefault()}
            </div>
          )}
        </div>
      )}
      {overlay?.(api)}
    </div>
  );
};
