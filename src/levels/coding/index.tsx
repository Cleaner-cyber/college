/**
 * 编程关 v2「第一个个人网站」：教学「AI 编程 / vibe coding」。大一下主线必修 · 全预设演出。
 * 工具推荐（点选）→ 需求填空拼提示词 → 对话生成 → 白屏 bug →
 * 报错三法（先口头描述 → F12 找控制台报错 → 原样粘贴）→ 修复 → 预览+下载本地 HTML → 收进作品集。
 */
import React, { useMemo, useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { getMajor, interpolate, ui } from '@/engine/content';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { Button } from '@/components/ui/Button';
import { ChatScript, type ChatStep } from '@/components/chat/ChatScript';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';

// ---------- 对话脚本 ----------

const BUILD_STEPS: ChatStep[] = [
  { type: 'senpai', key: 'senpai-s5-1' },
  { type: 'chip', labelKey: 'chip-build', promptKey: 'q-build', check: 'ck-prompt' },
  { type: 'ai', key: 'a-build' },
  { type: 'senpai', key: 'senpai-s5-2' },
  { type: 'button', labelKey: 'btn-open-file' },
];

const DESC_STEPS: ChatStep[] = [
  { type: 'senpai', key: 'senpai-s7-1' },
  { type: 'chip', labelKey: 'chip-desc', promptKey: 'q-desc' },
  { type: 'ai', key: 'a-desc' },
  { type: 'senpai', key: 'senpai-s7-2' },
  { type: 'button', labelKey: 'btn-f12' },
];

const FIX_STEPS: ChatStep[] = [
  { type: 'chip', labelKey: 'chip-paste', promptKey: 'q-paste', check: 'ck-paste' },
  { type: 'ai', key: 'a-fix' },
  { type: 'senpai', key: 'senpai-s9-1' },
  { type: 'button', labelKey: 'btn-reopen' },
];

// ---------- S3 工具选择 ----------

const TOOLS = [
  { id: 'trae', icon: 'icon-trae' },
  { id: 'cursor', icon: 'icon-cursor' },
  { id: 'cc', icon: 'icon-claude-code' },
] as const;

const ToolSelect: React.FC<{ api: FlowAPI; assets: Record<string, string> }> = ({
  api,
  assets,
}) => {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <header>
        <h1 className="text-xl font-semibold">{api.copy('tool-title')}</h1>
        <p className="mt-1 text-sm text-ink-soft">{api.copy('tool-sub')}</p>
      </header>
      <div className="grid grid-cols-3 gap-3">
        {TOOLS.map((t) => {
          const active = picked === t.id;
          return (
            <button
              key={t.id}
              onClick={() => {
                setPicked(t.id);
                if (t.id === 'trae') api.check('ck-tool');
              }}
              className={`flex flex-col items-center gap-2.5 rounded-2xl border bg-card p-4 text-center shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift ${
                active ? 'border-accent shadow-glow' : 'border-line'
              }`}
            >
              <img src={assets[t.icon]} alt="" className="h-14 w-14 rounded-xl" />
              <span className="text-[15px] font-semibold">{api.copy(`tool-${t.id}-name`)}</span>
              <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10.5px] font-medium text-accent">
                {api.copy(`tool-${t.id}-badge`)}
              </span>
              <span className="text-xs leading-relaxed text-ink-soft">
                {api.copy(`tool-${t.id}-desc`)}
              </span>
              <span className="text-[11px] text-ink-soft/70">{api.copy(`tool-${t.id}-site`)}</span>
            </button>
          );
        })}
      </div>
      <p
        key={picked ?? 'none'}
        className={`rounded-xl p-3.5 text-[13.5px] leading-relaxed animate-fade-up ${
          picked === 'trae'
            ? 'bg-accent-soft/70 text-ink'
            : picked
              ? 'bg-card text-ink-soft'
              : 'bg-card text-ink-soft'
        }`}
      >
        <span className="mr-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">
          {ui.board['senpai-prefix']}
        </span>
        {picked === 'trae'
          ? api.copy('tool-trae-note')
          : picked
            ? api.copy('tool-other-note')
            : api.copy('tool-install-note')}
      </p>
      <Button full disabled={picked !== 'trae'} onClick={api.advance}>
        {api.copy('tool-confirm')}
      </Button>
    </div>
  );
};

// ---------- S4 需求填空 ----------

/** 用户输入清洗：进入 HTML 模板前去掉可能破坏结构的字符 */
const clean = (s: string) => s.replace(/[<>"'`]/g, '').trim();

const COLORS = ['a', 'b', 'c'] as const;

const SiteForm: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [tagline, setTagline] = useState(() => api.copy('form-tagline-default'));
  const [hobbies, setHobbies] = useState(() => api.copy('form-hobbies-default'));
  const [showcase, setShowcase] = useState(() => api.copy('form-showcase-default'));
  const [color, setColor] = useState<(typeof COLORS)[number]>('a');

  const preview = useMemo(
    () =>
      interpolate(api.copy('q-build'), {
        tagline: clean(tagline),
        hobbies: clean(hobbies),
        showcase: clean(showcase),
        colorName: api.copy(`color-${color}-label`),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tagline, hobbies, showcase, color],
  );
  const tags = clean(hobbies)
    .split(/[·,，、/|]/)
    .map((h) => h.trim())
    .filter(Boolean);
  const ready = clean(tagline).length > 0 && clean(showcase).length > 0 && tags.length > 0;

  const field = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    maxLength: number,
  ) => (
    <label className="block">
      <span className="text-xs tracking-widest text-ink-soft">{label}</span>
      <input
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-line bg-card px-4 py-2.5 text-[14.5px] outline-none transition focus:border-accent focus:shadow-glow"
      />
    </label>
  );

  const send = () => {
    api.setVar('tagline', clean(tagline));
    api.setVar('hobbies', clean(hobbies));
    api.setVar('showcase', clean(showcase));
    api.setVar('colorName', api.copy(`color-${color}-label`));
    api.setVar('accentColor', api.copy(`color-${color}-value`));
    api.setVar('hobbyTags', tags.map((h) => `<span class="tag">${h}</span>`).join(''));
    api.advance();
  };

  return (
    <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-6">
      <div className="flex flex-col gap-4">
        <header>
          <h1 className="text-xl font-semibold">{api.copy('s4-title')}</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{api.copy('s4-sub')}</p>
        </header>
        {field(api.copy('form-tagline-label'), tagline, setTagline, 40)}
        {field(api.copy('form-hobbies-label'), hobbies, setHobbies, 30)}
        {field(api.copy('form-showcase-label'), showcase, setShowcase, 60)}
        <div>
          <span className="text-xs tracking-widest text-ink-soft">
            {api.copy('form-color-label')}
          </span>
          <div className="mt-1.5 flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={`flex items-center gap-1.5 rounded-full border bg-accent-soft/60 px-3 py-1.5 text-[12.5px] transition ${
                  color === c ? 'border-accent text-accent shadow-glow' : 'border-line text-ink-soft'
                }`}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ background: api.copy(`color-${c}-value`) }}
                />
                {api.copy(`color-${c}-label`)}
              </button>
            ))}
          </div>
        </div>
        <Button full disabled={!ready} onClick={send}>
          {api.copy('s4-send')}
        </Button>
      </div>
      <div>
        <div className="mb-2 text-[11px] tracking-widest text-ink-soft">
          {api.copy('s4-preview-title')}
        </div>
        <div className="max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-line bg-card p-5 text-[13.5px] leading-relaxed shadow-soft">
          {preview}
        </div>
      </div>
    </div>
  );
};

// ---------- 浏览器窗口壳（S6 白屏 / S9P 成品共用） ----------

const BrowserFrame: React.FC<{ address: string; children: React.ReactNode }> = ({
  address,
  children,
}) => (
  <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-lift">
    <div className="flex items-center gap-2 border-b border-line bg-paper/70 px-4 py-2.5">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
      </span>
      <span className="ml-2 flex-1 truncate rounded-full bg-card px-3 py-1 text-[12px] text-ink-soft">
        {address}
      </span>
    </div>
    {children}
  </div>
);

const BrokenPreview: React.FC<{ api: FlowAPI }> = ({ api }) => (
  <div className="mx-auto flex max-w-2xl flex-col gap-4">
    <BrowserFrame address={api.copy('s6-title')}>
      <div className="flex h-[300px] items-center justify-center bg-white" />
    </BrowserFrame>
    <p className="text-center text-[15px] text-ink-soft">{api.copy('s6-white-line')}</p>
    <p className="rounded-xl bg-accent-soft/60 p-3.5 text-[13.5px] leading-relaxed">
      <span className="mr-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">
        {ui.board['senpai-prefix']}
      </span>
      {api.copy('s6-senpai')}
    </p>
    <Button full onClick={api.advance}>
      {api.nextLabel}
    </Button>
  </div>
);

// ---------- S8 开发者工具（F12 教学） ----------

const DevToolsPanel: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-line shadow-lift">
        <div className="flex items-center gap-1 bg-[#2b2a27] px-3 pt-2 text-[12px] text-paper/60">
          <span className="rounded-t-lg px-3 py-1.5">{api.copy('s8-tab-elements')}</span>
          <span className="rounded-t-lg bg-[#1e1d1b] px-3 py-1.5 font-medium text-paper">
            {api.copy('s8-tab-console')}
          </span>
          <span className="rounded-t-lg px-3 py-1.5">{api.copy('s8-tab-network')}</span>
          <span className="ml-auto pb-1 pr-1 text-[14px]">✕</span>
        </div>
        <div className="bg-[#1e1d1b] p-4 font-mono text-[12.5px] leading-relaxed">
          <div className="flex items-start justify-between gap-3 rounded-lg border border-red-900/60 bg-red-950/40 p-3">
            <div className="min-w-0 text-red-400">
              <div className="break-all">⛔ {api.copy('s8-error-1')}</div>
              <div className="whitespace-pre text-red-400/70">{api.copy('s8-error-2')}</div>
            </div>
            <button
              onClick={() => {
                setCopied(true);
                api.check('ck-f12');
              }}
              className={`shrink-0 rounded-lg border px-2.5 py-1 font-sans text-[11.5px] transition ${
                copied
                  ? 'border-accent bg-accent text-white'
                  : 'border-paper/30 text-paper/80 hover:border-paper/60'
              }`}
            >
              {copied ? api.copy('s8-copied') : api.copy('s8-copy')}
            </button>
          </div>
          <div className="mt-2 text-paper/30">&gt;</div>
        </div>
      </div>
      <p className="rounded-xl bg-accent-soft/60 p-3.5 text-[13.5px] leading-relaxed">
        <span className="mr-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">
          {ui.board['senpai-prefix']}
        </span>
        {api.copy('s8-hint')}
      </p>
      <Button full disabled={!copied} onClick={api.advance}>
        {api.nextLabel}
      </Button>
    </div>
  );
};

// ---------- S9P 成品预览 + 下载 ----------

const SitePreview: React.FC<{ api: FlowAPI; html: string; filename: string }> = ({
  api,
  html,
  filename,
}) => {
  const [downloaded, setDownloaded] = useState(false);

  const download = () => {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <BrowserFrame address={api.copy('s6-title')}>
        <iframe
          title="preview"
          sandbox="allow-scripts"
          srcDoc={html}
          className="h-[440px] w-full bg-white"
        />
      </BrowserFrame>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-ink-soft">{api.copy('s9p-night-hint')}</p>
        <Button variant="secondary" onClick={download}>
          {downloaded ? api.copy('s9p-downloaded') : api.copy('s9p-download')}
        </Button>
      </div>
      <p className="rounded-xl bg-accent-soft/60 p-3.5 text-[13.5px] leading-relaxed">
        <span className="mr-1.5 rounded bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">
          {ui.board['senpai-prefix']}
        </span>
        {api.copy('s9p-senpai')}
      </p>
      <Button
        full
        onClick={() => {
          api.check('ck-ship');
          api.advance();
        }}
      >
        {api.copy('s9p-deliver')}
      </Button>
    </div>
  );
};

// ---------- 关卡组件 ----------

const CodingComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};
  const majorName = getMajor(state.player.majorId).name;

  // 拼进网站 HTML 的变量全部过 clean（玩家名来自序章输入，未清洗过）；只插值一次
  const buildSiteVars = (vars: Record<string, string>): Record<string, string> => ({
    ...vars,
    playerName: clean(state.player.name),
    majorName: clean(majorName),
  });

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: borrowed
      ? { portfolio: 1 }
      : done === checklist.length
        ? { portfolio: 2, academic: 1 }
        : { portfolio: 2 },
    abilityUnlocks: ['ai-coding'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'homepage-v1',
        levelId: 'coding',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
        assetRef: 'homepage-doc',
      },
      {
        id: 'prompt-ai-coding',
        levelId: 'coding',
        title: content.copy['prompt-item-title'],
        resumeLine: '',
        borrowed: false,
      },
    ],
  });

  return (
    <>
      <TaskPanel items={checklist} checked={checked} />
      <ScreenPlayer
        content={content}
        globalVars={{ playerName: state.player.name, majorName }}
        defaultNextLabel={ui.common.continue}
        senpaiLabel={ui.board['senpai-prefix']}
        wideScreens={['S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S9P']}
        onCheckChange={setChecked}
        custom={{
          S3: (api) => <ToolSelect api={api} assets={assets} />,
          S4: (api) => <SiteForm api={api} />,
          S5: (api) => (
            <ChatScript api={api} steps={BUILD_STEPS} assets={assets} onDone={api.advance} />
          ),
          S6: (api) => <BrokenPreview api={api} />,
          S7: (api) => <ChatScript api={api} steps={DESC_STEPS} assets={assets} onDone={api.advance} />,
          S8: (api) => <DevToolsPanel api={api} />,
          S9: (api) => <ChatScript api={api} steps={FIX_STEPS} assets={assets} onDone={api.advance} />,
          S9P: (api) => (
            <SitePreview
              api={api}
              html={interpolate(content.copy['site-html'] ?? '', buildSiteVars(api.vars))}
              filename={interpolate(content.copy['site-filename'] ?? 'index.html', {
                playerName: clean(state.player.name),
              })}
            />
          ),
          S10: (api) => (
            <DeliverScreen
              api={api}
              total={checklist.length}
              onDone={() => onComplete(buildResult(false, api.checked.length))}
            />
          ),
          ESC: (api) => (
            <DeliverScreen
              api={api}
              total={checklist.length}
              escape
              onDone={() => onEscape(buildResult(true, api.checked.length))}
            />
          ),
        }}
        overlay={(api) => <EscapeOverlay api={api} screens={['S4', 'S5', 'S7']} />}
        onFinish={(r) => onComplete(buildResult(false, r.checked.length))}
      />
    </>
  );
};

export const CodingLevel: LevelModule = { id: 'coding', Component: CodingComponent };
