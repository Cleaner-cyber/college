/**
 * 海报关：教学「生图+迭代」。选修·深度·全预设演出。
 * 自定义屏：S3 喂料工作台 / S5 首版出图 / S7 提示词可视化修改 / S9 16:9 版 / S10 交付 / ESC。
 * 任意时刻可点 [问学长] 跳过，产物入库并标记 borrowed。
 */
import React, { useEffect, useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { ui, interpolate } from '@/engine/content';
import { Button } from '@/components/ui/Button';
import { TaskPanel } from '@/components/ui/TaskPanel';

const STYLE_KEYS = ['jj', 'sh', 'sy'] as const;
const SIZES = ['3:4', '16:9', '1:1'] as const;
const ESCAPABLE_SCREENS = ['S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9'];

/** S3 喂料工作台：社团名 + 风格三选一 + 尺寸 */
const FeedBench: React.FC<{ api: FlowAPI; assets: Record<string, string> }> = ({
  api,
  assets,
}) => {
  const [club, setClub] = useState('');
  const [style, setStyle] = useState<string>('');
  const [size, setSize] = useState<string>('');
  const defaultClub = api.screen.placeholder ?? '';

  const canGenerate = style !== '' && size === '3:4';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1.5 text-xs tracking-widest text-ink-soft">
          {api.copy('s3-club-label')}
        </div>
        <input
          value={club}
          maxLength={12}
          onChange={(e) => setClub(e.target.value)}
          placeholder={defaultClub}
          className="w-full rounded-xl border border-line bg-card px-4 py-3 text-[16px] outline-none focus:border-accent"
        />
        <p className="mt-1 text-xs text-ink-soft">{api.copy('s3-club-hint')}</p>
      </div>

      <div>
        <div className="mb-1.5 text-xs tracking-widest text-ink-soft">
          {api.copy('s3-style-label')}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {STYLE_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setStyle(key)}
              className={`rounded-xl border-2 p-1.5 transition ${
                style === key ? 'border-accent' : 'border-line'
              }`}
            >
              <img
                src={assets[`poster-${key}-34-v1`]}
                alt={api.copy(`s3-style-${key}`)}
                className="aspect-[3/4] w-full rounded-lg object-cover"
              />
              <div className="mt-1 text-center text-sm">{api.copy(`s3-style-${key}`)}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1.5 text-xs tracking-widest text-ink-soft">
          {api.copy('s3-size-label')}
        </div>
        <div className="flex gap-2">
          {SIZES.map((s) => (
            <button
              key={s}
              onClick={() => {
                setSize(s);
                if (s === '3:4') api.check('ck-ratio');
              }}
              className={`rounded-xl border-2 px-4 py-2 text-sm transition ${
                size === s ? 'border-accent bg-accent-soft' : 'border-line bg-card'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        {size !== '' && size !== '3:4' && (
          <p className="mt-2 text-xs text-accent animate-fade-up">{api.copy('s3-size-warn')}</p>
        )}
        <p className="mt-2 text-xs text-ink-soft">{api.copy('s3-size-note')}</p>
      </div>

      <Button
        full
        disabled={!canGenerate}
        onClick={() => {
          const clubName = club.trim() || defaultClub;
          api.setVar('clubName', clubName);
          api.setVar('style', style);
          api.setVar('styleName', api.copy(`s3-style-${style}`));
          api.advance();
        }}
      >
        {api.copy('s3-generate')}
      </Button>
    </div>
  );
};

/** 出图屏：图 + 社团名文字层叠加 */
const PosterImage: React.FC<{ src?: string; clubName?: string }> = ({ src, clubName }) => (
  <div className="relative mx-auto w-full max-w-[300px] animate-fade-up">
    {src && <img src={src} alt="" className="w-full rounded-xl border border-line shadow-sm" />}
    {clubName && (
      <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-black/55 px-2 py-0.5 text-xs text-white">
        {clubName}
      </span>
    )}
  </div>
);

const FirstShot: React.FC<{ api: FlowAPI; assets: Record<string, string> }> = ({
  api,
  assets,
}) => {
  useEffect(() => {
    api.check('ck-name');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex flex-col gap-5">
      <PosterImage
        src={assets[api.t('poster-{style}-34-v1')]}
        clubName={api.vars.clubName}
      />
      <p className="whitespace-pre-wrap text-[16px] leading-relaxed">
        {api.t(api.screen.text ?? '')}
      </p>
      <Button full onClick={api.advance}>
        {api.nextLabel}
      </Button>
    </div>
  );
};

/** S7 修改选择：提示词可视化 */
const ReviseBench: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [picked, setPicked] = useState<string>('');
  const pickedChoice = (api.screen.choices ?? []).find((c) => c.setVar?.value === picked);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-[17px]">{api.t(api.screen.text ?? '')}</p>
      <div className="flex flex-col gap-2">
        {(api.screen.choices ?? []).map((c) => (
          <Button
            key={c.id}
            variant="secondary"
            full
            className={c.setVar?.value === picked ? '!border-accent' : ''}
            onClick={() => setPicked(c.setVar?.value ?? '')}
          >
            {c.label}
          </Button>
        ))}
      </div>
      {/* 提示词同步展示 */}
      <div className="rounded-xl bg-card p-3 text-[13px] leading-relaxed text-ink-soft">
        <div className="mb-1 text-[11px] tracking-widest">{api.copy('s7-prompt-title')}</div>
        {api.copy('s7-prompt-base')}
        {picked && (
          <span className="ml-1 rounded bg-accent-soft px-1 font-medium text-accent animate-fade-up">
            {api.copy(`s7-append-${picked}`)}
          </span>
        )}
      </div>
      {picked && pickedChoice && (
        <Button
          full
          className="animate-fade-up"
          onClick={() => {
            api.setVar('revision', picked);
            api.check('ck-space');
            api.goto(pickedChoice.next);
          }}
        >
          {api.copy('s7-regen')}
        </Button>
      )}
    </div>
  );
};

const WideShot: React.FC<{ api: FlowAPI; assets: Record<string, string> }> = ({
  api,
  assets,
}) => {
  useEffect(() => {
    api.check('ck-169');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[16px]">{api.t(api.screen.text ?? '')}</p>
      <img
        src={assets[api.t('poster-{style}-169')]}
        alt=""
        className="w-full rounded-xl border border-line shadow-sm animate-fade-up"
      />
      <Button full onClick={api.advance}>
        {api.nextLabel}
      </Button>
    </div>
  );
};

/** S10 / ESC 交付屏 */
const Deliver: React.FC<{
  api: FlowAPI;
  assets: Record<string, string>;
  total: number;
  escape?: boolean;
  onDone: () => void;
}> = ({ api, assets, total, escape = false, onDone }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const imgA = escape ? assets['poster-senpai-34'] : assets[api.t('poster-{style}-34-v2')];
  const imgB = escape ? assets['poster-senpai-169'] : assets[api.t('poster-{style}-169')];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-3 animate-fade-up">
        <img src={imgA} alt="" className="w-[46%] rounded-lg border border-line shadow-sm" />
        <img src={imgB} alt="" className="w-1/2 rounded-lg border border-line shadow-sm" />
      </div>
      {!escape && (
        <p className="text-center text-sm font-medium text-accent">
          {interpolate(api.copy('s10-checklist-done'), {
            done: api.checked.length,
            total,
          })}
        </p>
      )}
      <p className="whitespace-pre-wrap text-[16px] leading-relaxed">
        {api.t(api.screen.text ?? '')}
      </p>
      {!escape && (
        <div className="text-[15px] leading-relaxed text-ink-soft">
          <p>{api.copy('s10-npc-line')}</p>
          <p>{api.copy('s10-senpai-line')}</p>
        </div>
      )}
      {!escape && (
        <button
          className="text-left text-sm text-accent underline underline-offset-4"
          onClick={() => setShowPrompt((v) => !v)}
        >
          {api.copy('s10-show-prompt')}
        </button>
      )}
      {showPrompt && (
        <div className="rounded-xl bg-card p-3 text-[13px] leading-relaxed text-ink-soft animate-fade-up">
          {api.copy('s10-full-prompt')}
        </div>
      )}
      <Button full onClick={onDone}>
        {api.nextLabel}
      </Button>
    </div>
  );
};

/** [问学长] 浮动按钮 + 确认弹层 */
const EscapeOverlay: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [confirming, setConfirming] = useState(false);
  if (!ESCAPABLE_SCREENS.includes(api.screen.id)) return null;
  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="fixed bottom-5 right-4 z-20 rounded-full border border-line bg-card px-4 py-2 text-sm text-ink-soft shadow-sm"
      >
        {api.copy('esc-button')}
      </button>
      {confirming && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-5">
          <div className="w-full max-w-app rounded-2xl bg-paper p-5 animate-fade-up">
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

const PosterComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { portfolio: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['image-gen'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'poster-y1',
        levelId: 'poster',
        title: borrowed
          ? content.copy['archive-title-borrowed']
          : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
        assetRef: borrowed ? 'poster-senpai-34' : 'poster-y1',
      },
    ],
  });

  return (
    <>
      <TaskPanel items={checklist} checked={checked} />
      <ScreenPlayer
        content={content}
        globalVars={{ playerName: state.player.name }}
        defaultNextLabel={ui.common.continue}
        senpaiLabel={ui.board['senpai-prefix']}
        onCheckChange={setChecked}
        custom={{
          S3: (api) => <FeedBench api={api} assets={assets} />,
          S5: (api) => <FirstShot api={api} assets={assets} />,
          S7: (api) => <ReviseBench api={api} />,
          S9: (api) => <WideShot api={api} assets={assets} />,
          S10: (api) => (
            <Deliver
              api={api}
              assets={assets}
              total={checklist.length}
              onDone={() => onComplete(buildResult(false, api.checked.length))}
            />
          ),
          ESC: (api) => (
            <Deliver
              api={api}
              assets={assets}
              total={checklist.length}
              escape
              onDone={() => onEscape(buildResult(true, api.checked.length))}
            />
          ),
        }}
        overlay={(api) => <EscapeOverlay api={api} />}
        onFinish={(r) => onComplete(buildResult(false, r.checked.length))}
      />
    </>
  );
};

export const PosterLevel: LevelModule = { id: 'poster', Component: PosterComponent };
