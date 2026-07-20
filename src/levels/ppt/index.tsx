/**
 * PPT 关：教学「结构化生成」。大一下主线必修 · 全预设演出。
 * 场景：英语课「学生当老师」，为 Paragraph 3 精读做课堂展示 PPT。
 * S3 两条路对话：①一句话生成（真实成品，内容失控）→ ②AI 写逐页大纲（文档查看器）→
 * ③按大纲精准控制一版（真实成品，逐页对得上）。
 * S4 工具横评擂台：10 款主流工具星级横评 + 真实成品陈列（翻页灯箱）。
 * 成品图为各工具对同一任务的真实生成结果（截图入库，同名可替换）。
 */
import React, { useEffect, useRef, useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { ui, interpolate } from '@/engine/content';
import { Button } from '@/components/ui/Button';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { renderMarkdown } from '@/components/ui/Markdown';
import { DocViewer } from '@/components/ui/DocViewer';
import { SenpaiAvatar } from '@/components/ui/SpeakerTag';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';
import { SlideViewer, type SlideViewerLabels } from './SlideViewer';

/** 成品档位：槽位名=工具名（来自用户上传压缩包的文件名），展示名/注释由 deck-{id}-name/note 决定 */
const DECK_IDS = [
  'claude',
  'gamma',
  'notebooklm',
  'gemini',
  'kimi',
  'gpt',
  'manus',
  'qianwen',
  'doubao',
  'lingxi',
] as const;
type DeckId = (typeof DECK_IDS)[number];
const TOOL_COUNT = 10;

/** 逐页扫描资产表取页图（各工具页数不同：Gamma 6 页 / Manus 10 页 / 其余 9 页） */
const deckPages = (assets: Record<string, string>, id: DeckId): string[] => {
  const pages: string[] = [];
  for (let i = 1; assets[`cmp-${id}-${i}`]; i++) pages.push(assets[`cmp-${id}-${i}`]);
  return pages;
};

const viewerLabels = (api: FlowAPI): SlideViewerLabels => ({
  close: api.copy('viewer-close'),
  counter: api.copy('viewer-counter'),
  hint: api.copy('viewer-hint'),
});

/* ---------------- S3 · 两条路对话 ---------------- */

type Step =
  | { k: 'senpai'; key: string }
  | { k: 'chip'; label: string; prompt: string; check?: string }
  | { k: 'ai'; key: string; deck?: DeckId; doc?: boolean }
  | { k: 'button'; key: string };

// 第一关只汇报不展示成品（学长点评"听它汇报"即失控），最终成品在第二关按大纲生成后亮出
const STEPS: Step[] = [
  { k: 'senpai', key: 'senpai-tip-1' },
  { k: 'chip', label: 'chip-flash', prompt: 'q-flash', check: 'ck-flash' },
  { k: 'ai', key: 'a-flash' },
  { k: 'senpai', key: 'senpai-tip-2' },
  { k: 'senpai', key: 'senpai-tip-3' },
  { k: 'chip', label: 'chip-outline', prompt: 'q-outline', check: 'ck-outline' },
  { k: 'ai', key: 'a-outline', doc: true },
  { k: 'senpai', key: 'senpai-tip-4' },
  { k: 'chip', label: 'chip-feed', prompt: 'q-feed', check: 'ck-control' },
  { k: 'ai', key: 'a-control', deck: 'claude' },
  { k: 'senpai', key: 'senpai-wrap' },
  { k: 'button', key: 'btn-arena' },
];

type Msg =
  | { kind: 'user'; text: string }
  | { kind: 'ai'; text: string; done: boolean }
  | { kind: 'senpai'; text: string }
  | { kind: 'deck'; id: DeckId; titleKey: string }
  | { kind: 'doc' };

const DECK_CHAT_TITLE: Record<string, string> = {
  claude: 'deck-control-card-title',
};

const Thinking: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2 text-[13px] text-ink-soft">
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
          style={{ animationDelay: `${i * 0.25}s` }}
        />
      ))}
    </span>
    {label}
  </div>
);

/** 对话内成品/文档卡片 */
const ChatCard: React.FC<{
  icon: string;
  title: string;
  meta: string;
  onOpen: () => void;
}> = ({ icon, title, meta, onOpen }) => (
  <div className="flex justify-start animate-fade-up">
    <button
      onClick={onOpen}
      className="flex w-[360px] max-w-[92%] items-center gap-3 rounded-2xl rounded-tl-md border border-accent/40 bg-card p-3.5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[11.5px] text-ink-soft">{meta}</span>
      </span>
      <span className="shrink-0 text-ink-soft">›</span>
    </button>
  </div>
);

const TwoRoadsChat: React.FC<{ api: FlowAPI; assets: Record<string, string> }> = ({
  api,
  assets,
}) => {
  const [idx, setIdx] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [inputText, setInputText] = useState('');
  const [typingText, setTypingText] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamCount, setStreamCount] = useState(0);
  const [viewer, setViewer] = useState<DeckId | null>(null);
  const [docOpen, setDocOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const step = STEPS[idx] as Step | undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, streamCount, thinking, inputText]);

  // 提示词打字时输入框自动滚到最新一行
  useEffect(() => {
    const el = inputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [inputText]);

  // 自动步骤：senpai / ai
  useEffect(() => {
    if (!step) return;
    if (step.k === 'senpai') {
      const t = window.setTimeout(() => {
        setMsgs((m) => [...m, { kind: 'senpai', text: api.copy(step.key) }]);
        setIdx((i) => i + 1);
      }, 380);
      return () => window.clearTimeout(t);
    }
    if (step.k === 'ai') {
      setThinking(true);
      const t = window.setTimeout(() => {
        setThinking(false);
        setMsgs((m) => [...m, { kind: 'ai', text: api.copy(step.key), done: false }]);
        setStreamCount(0);
        setStreaming(true);
      }, 1500);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // 流式输出 → 结束后补成品/文档卡片
  useEffect(() => {
    if (!streaming || !step || step.k !== 'ai') return;
    const full = api.copy(step.key);
    if (streamCount >= full.length) {
      setMsgs((m) => {
        const done: Msg[] = m.map((msg) => (msg.kind === 'ai' ? { ...msg, done: true } : msg));
        if (step.deck) done.push({ kind: 'deck', id: step.deck, titleKey: DECK_CHAT_TITLE[step.deck] });
        if (step.doc) done.push({ kind: 'doc' });
        return done;
      });
      setStreaming(false);
      setIdx((i) => i + 1);
      return;
    }
    const t = window.setTimeout(() => setStreamCount((c) => Math.min(full.length, c + 9)), 14);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, streamCount, idx]);

  // chip 打字动画 → 发送
  useEffect(() => {
    if (typingText === null) return;
    let i = 0;
    const t = window.setInterval(() => {
      i = Math.min(typingText.length, i + 4);
      setInputText(typingText.slice(0, i));
      if (i >= typingText.length) {
        window.clearInterval(t);
        window.setTimeout(() => {
          setInputText('');
          setMsgs((m) => [...m, { kind: 'user', text: typingText }]);
          setTypingText(null);
          setIdx((v) => v + 1);
        }, 420);
      }
    }, 20);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingText]);

  const outlineMd = api.copy('outline-doc-md');

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-accent-soft/60 p-2.5 text-[12px] leading-relaxed text-ink-soft">
        {api.copy('s3-steps')}
      </p>

      <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border-2 border-line bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b border-line bg-paper/60 px-4 py-2.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="h-2 w-2 rounded-full bg-line" />
            <span className="h-2 w-2 rounded-full bg-line" />
          </span>
          <span className="ml-1 text-[13px] font-medium">{api.copy('chat-title')}</span>
          {streaming && (
            <span className="ml-auto text-[11px] text-ink-soft">{api.copy('chat-skip-hint')}</span>
          )}
        </div>

        {/* 消息区 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            {msgs.map((m, i) => {
              if (m.kind === 'user') {
                return (
                  <div key={i} className="flex justify-end animate-fade-up">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[13px] leading-relaxed text-paper">
                      {m.text}
                    </div>
                  </div>
                );
              }
              if (m.kind === 'senpai') {
                return (
                  <div key={i} className="flex items-start gap-2 py-1 animate-fade-up">
                    <SenpaiAvatar size={26} />
                    <p className="whitespace-pre-wrap pt-0.5 text-[12.5px] leading-relaxed text-accent">
                      {m.text}
                    </p>
                  </div>
                );
              }
              if (m.kind === 'deck') {
                return (
                  <ChatCard
                    key={i}
                    icon="📽️"
                    title={api.copy(m.titleKey)}
                    meta={`${interpolate(api.copy('deck-pages-tpl'), {
                      n: deckPages(assets, m.id).length,
                    })} · ${api.copy('deck-open-hint')}`}
                    onOpen={() => setViewer(m.id)}
                  />
                );
              }
              if (m.kind === 'doc') {
                const sections = outlineMd.split('\n').filter((l) => l.startsWith('### ')).length;
                return (
                  <ChatCard
                    key={i}
                    icon="📄"
                    title={api.copy('outline-doc-title')}
                    meta={`${interpolate((ui.doc as Record<string, string>)['card-stats'], {
                      chars: outlineMd.replace(/[\s|#*-]/g, '').length.toLocaleString('zh-CN'),
                      sections,
                    })} · ${(ui.doc as Record<string, string>)['open-hint']}`}
                    onOpen={() => setDocOpen(true)}
                  />
                );
              }
              const isLast = i === msgs.length - 1;
              const shown = !m.done && isLast && streaming ? m.text.slice(0, streamCount) : m.text;
              return (
                <div key={i} className="flex justify-start animate-fade-up">
                  <div
                    onClick={() => {
                      if (!m.done && streaming) setStreamCount(m.text.length);
                    }}
                    className="max-w-[92%] rounded-2xl rounded-tl-md border border-line/70 bg-paper px-4 py-3 shadow-soft"
                  >
                    {renderMarkdown(shown)}
                    {!m.done && isLast && <span className="animate-pulse text-accent">▍</span>}
                  </div>
                </div>
              );
            })}
            {thinking && <Thinking label={api.copy('chat-thinking')} />}
          </div>
        </div>

        {/* 输入区 */}
        <div className="border-t border-line px-4 py-3">
          {step?.k === 'chip' && typingText === null && (
            <button
              onClick={() => {
                if (step.check) api.check(step.check);
                setTypingText(api.copy(step.prompt));
              }}
              className="mb-2.5 rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-left text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-soft animate-fade-up"
            >
              {api.copy(step.label)}
            </button>
          )}
          {step?.k === 'button' && (
            <div className="mb-2.5 animate-fade-up">
              <Button onClick={api.advance}>{api.copy(step.key)}</Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <div
              ref={inputRef}
              className={`max-h-[130px] min-h-[42px] flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px] leading-relaxed ${
                inputText ? 'text-ink' : 'text-ink-soft/60'
              }`}
            >
              {inputText || api.copy('chat-input-placeholder')}
              {typingText !== null && <span className="animate-pulse text-accent">▍</span>}
            </div>
            <button
              disabled
              className="rounded-xl bg-ink px-4 py-2.5 text-[13px] text-paper opacity-40"
            >
              {ui.common.confirm}
            </button>
          </div>
        </div>
      </div>

      {viewer && (
        <SlideViewer
          title={api.copy(DECK_CHAT_TITLE[viewer])}
          pages={deckPages(assets, viewer)}
          labels={viewerLabels(api)}
          onClose={() => setViewer(null)}
        />
      )}
      {docOpen && (
        <DocViewer
          title={api.copy('outline-doc-title')}
          md={outlineMd}
          onClose={() => setDocOpen(false)}
        />
      )}
    </div>
  );
};

/* ---------------- S4 · 工具横评擂台 ---------------- */

const Arena: React.FC<{ api: FlowAPI; assets: Record<string, string> }> = ({ api, assets }) => {
  const [viewer, setViewer] = useState<DeckId | null>(null);

  // 到场即算看过横评（验收项）
  useEffect(() => {
    api.check('ck-arena');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tools = Array.from({ length: TOOL_COUNT }, (_, i) => ({
    name: api.copy(`t${i + 1}-name`),
    stars: api.copy(`t${i + 1}-stars`),
    pro: api.copy(`t${i + 1}-pro`),
    con: api.copy(`t${i + 1}-con`),
    net: api.copy(`t${i + 1}-net`),
    url: api.copy(`t${i + 1}-url`),
  }));
  const decks = DECK_IDS.filter((id) => assets[`cmp-${id}-1`]).map((id) => ({
    id,
    name: api.copy(`deck-${id}-name`),
    note: api.copy(`deck-${id}-note`),
  }));
  const starsOf = (name: string) => tools.find((t) => t.name === name)?.stars ?? '';
  const hasDeck = (name: string) => decks.some((d) => d.name === name);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold">{api.copy('arena-title')}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft">{api.copy('arena-sub')}</p>
      </div>

      {/* 横评总表 */}
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-soft">
        <table className="w-full border-collapse text-left text-[12px] leading-relaxed">
          <thead>
            <tr className="border-b border-line bg-paper/70 text-[11.5px] tracking-wide text-ink-soft">
              <th className="px-3 py-2 font-medium">{api.copy('th-tool')}</th>
              <th className="px-2 py-2 font-medium">{api.copy('th-stars')}</th>
              <th className="px-3 py-2 font-medium">{api.copy('th-pro')}</th>
              <th className="px-3 py-2 font-medium">{api.copy('th-con')}</th>
              <th className="px-2 py-2 font-medium">{api.copy('th-net')}</th>
              <th className="px-3 py-2 font-medium">{api.copy('th-url')}</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((t) => (
              <tr key={t.name} className="border-b border-line/60 align-top last:border-b-0">
                <td className="whitespace-nowrap px-3 py-2 text-[12.5px] font-semibold">
                  {t.name}
                  {hasDeck(t.name) && (
                    <span className="ml-1.5 rounded bg-accent-soft px-1 py-0.5 text-[10px] font-normal text-accent">
                      成品↓
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-2 tracking-tight text-accent">{t.stars}</td>
                <td className="px-3 py-2">{t.pro}</td>
                <td className="px-3 py-2 text-ink-soft">{t.con}</td>
                <td className="whitespace-nowrap px-2 py-2">
                  <span className={t.net === '直接可用' ? 'text-accent' : 'text-ink-soft'}>
                    {t.net}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <a
                    href={`https://${t.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-ink-soft underline decoration-line underline-offset-2 transition hover:text-accent"
                  >
                    {t.url}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 真实成品陈列 */}
      <div>
        <h3 className="text-[15px] font-semibold">{api.copy('gallery-title')}</h3>
        <p className="mt-0.5 text-[12px] text-ink-soft">{api.copy('gallery-sub')}</p>
        <div className="mt-3 grid grid-cols-5 gap-3">
          {decks.map((d) => (
            <button
              key={d.id}
              onClick={() => setViewer(d.id)}
              className="group overflow-hidden rounded-xl border border-line bg-card text-left shadow-soft transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lift"
            >
              <div className="aspect-video overflow-hidden border-b border-line bg-paper">
                <img
                  src={assets[`cmp-${d.id}-1`]}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-2.5">
                <div className="flex items-baseline justify-between gap-1">
                  <span className="truncate text-[12.5px] font-semibold">{d.name}</span>
                  <span className="shrink-0 text-[10.5px] tracking-tight text-accent">
                    {starsOf(d.name)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-ink-soft">
                  {d.note}
                </p>
                <p className="mt-1 text-[10.5px] text-accent">
                  {interpolate(api.copy('deck-pages-tpl'), { n: deckPages(assets, d.id).length })}{' '}
                  · {api.copy('deck-open-hint')} ›
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-accent-soft/60 p-3">
        <SenpaiAvatar size={26} />
        <p className="pt-0.5 text-[12.5px] leading-relaxed text-accent">
          {api.copy('arena-senpai')}
        </p>
      </div>

      <Button full onClick={api.advance}>
        {api.copy('btn-finish')}
      </Button>

      {viewer && (
        <SlideViewer
          title={api.copy(`deck-${viewer}-name`)}
          note={api.copy(`deck-${viewer}-note`)}
          pages={deckPages(assets, viewer)}
          labels={viewerLabels(api)}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
};

/* ---------------- 关卡组装 ---------------- */

const PptComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    // PPT 是表达型工作：满勾给表达+2，其余+1
    deltas: { expression: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['structured-gen'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'ppt-deck',
        levelId: 'ppt',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
        assetRef: 'ppt-cmp-claude-1.jpg',
      },
      {
        // AI 写的逐页大纲进作品集（点开走文档查看器）
        id: 'doc-ppt-outline',
        levelId: 'ppt',
        title: content.copy['outline-doc-title'],
        resumeLine: content.copy['archive-outline-line'],
        borrowed: false,
        assetRef: 'ai-doc',
      },
      {
        // 学长的工具横评表（文档查看器）
        id: 'doc-ppt-tools',
        levelId: 'ppt',
        title: content.copy['tools-doc-title'],
        resumeLine: content.copy['archive-tools-line'],
        borrowed: false,
        assetRef: 'ai-doc',
      },
      {
        // 学完即沉淀：两条路提示词模板入库
        id: 'prompt-structured-gen',
        levelId: 'ppt',
        title: content.copy['prompt-item-title'],
        resumeLine: '',
        borrowed: false,
      },
    ],
  });

  return (
    <>
      <TaskPanel items={checklist} checked={checked} title={content.copy['checklist-title']} />
      <ScreenPlayer
        content={content}
        globalVars={{ playerName: state.player.name }}
        defaultNextLabel={ui.common.continue}
        senpaiLabel={ui.board['senpai-prefix']}
        wideScreens={['S3', 'S4']}
        onCheckChange={setChecked}
        custom={{
          S3: (api) => <TwoRoadsChat api={api} assets={assets} />,
          S4: (api) => <Arena api={api} assets={assets} />,
          S10: (api) => (
            <DeliverScreen
              api={api}
              total={checklist.length}
              img={assets['cmp-claude-1']}
              onDone={() => onComplete(buildResult(false, api.checked.length))}
            />
          ),
          ESC: (api) => (
            <DeliverScreen
              api={api}
              total={checklist.length}
              img={assets['cmp-claude-1']}
              escape
              onDone={() => onEscape(buildResult(true, api.checked.length))}
            />
          ),
        }}
        overlay={(api) => <EscapeOverlay api={api} screens={['S3', 'S4']} />}
        onFinish={(r) => onComplete(buildResult(false, r.checked.length))}
      />
    </>
  );
};

export const PptLevel: LevelModule = { id: 'ppt', Component: PptComponent };
