/**
 * Home 主界面（桌面端游戏 hub）：
 * 左侧导航（本学期/文件夹/属性/记录 + 四年时间轴）
 * 中间内容区（主线任务 / 选修行动板 / 档案 / 属性 / 记录）
 * 右侧状态栏（行动点 / 四轴 / 四年目标 / 已解锁能力）
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ArchiveItem, PlayerState, QuickAction } from '@/contracts';
import {
  boards,
  getFolderSection,
  getLevelContent,
  getMajor,
  interpolate,
  quickActions,
  ui,
} from '@/engine/content';
import { useEngine, effectiveCost, isMainlineComplete } from '@/engine/store';
import { useAuth } from '@/services/auth';
import { isCloudMode } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { PromptText, renderMarkdown } from '@/components/ui/Markdown';

const home = ui.home as Record<string, string>;
const VISIBLE_AXES = ['academic', 'portfolio', 'expression', 'cash'] as const;
const AXIS_MAX = 8;

type Tab = 'semester' | 'folder' | 'stats' | 'log';

// ---------- 右侧状态栏 ----------

const AxisBar: React.FC<{ label: string; value: number; strong?: boolean }> = ({
  label,
  value,
  strong = false,
}) => (
  <div className="flex items-center gap-3">
    <span className="w-8 shrink-0 text-right text-xs text-ink-soft">{label}</span>
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${strong ? 'bg-accent' : 'bg-ink'}`}
        style={{ width: `${Math.max(0, Math.min(100, (value / AXIS_MAX) * 100))}%` }}
      />
    </div>
    <span className="w-4 text-right text-xs font-semibold">{value}</span>
  </div>
);

const StatusRail: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => (
  <div className="flex flex-col gap-4">
    <Panel title={home['action-points']}>
      <div className="flex items-center gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <span
            key={i}
            className={`inline-block h-4 w-4 rounded-full ${
              i < state.actionPoints ? 'bg-accent' : 'border border-line bg-paper'
            }`}
          />
        ))}
        <span className="ml-1 text-sm font-semibold">{state.actionPoints}/3</span>
      </div>
    </Panel>
    <Panel title={home['stats-title']}>
      <div className="flex flex-col gap-2.5">
        {VISIBLE_AXES.map((a) => (
          <AxisBar key={a} label={ui.axes[a]} value={state.axes[a]} />
        ))}
        <AxisBar label={ui.axes.energy} value={state.axes.energy} strong />
      </div>
    </Panel>
    <Panel title={home['stats-flag-title']}>
      <dl className="grid grid-cols-1 gap-1.5 text-sm">
        {(
          [
            ['stats-flag-salary', state.flag.salaryBand],
            ['stats-flag-city', state.flag.city],
            ['stats-flag-work', state.flag.workStyle],
            ['stats-flag-time', state.flag.offTime],
          ] as const
        ).map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between">
            <dt className="text-xs text-ink-soft">{home[k]}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
    </Panel>
    <Panel title={home['stats-abilities-title']}>
      {state.abilities.length === 0 ? (
        <p className="text-xs leading-relaxed text-ink-soft">{home['stats-abilities-empty']}</p>
      ) : (
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
      )}
    </Panel>
  </div>
);

// ---------- 左侧导航 ----------

const NavIcon: React.FC<{ tab: Tab }> = ({ tab }) => {
  const paths: Record<Tab, React.ReactNode> = {
    semester: (
      <>
        <rect x="3" y="4" width="14" height="13" rx="2" />
        <path d="M6.5 9l2 2 4-4M6.5 13.5h7" />
      </>
    ),
    folder: <path d="M3 6a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />,
    stats: <path d="M4 16V9M10 16V4M16 16v-5" />,
    log: <path d="M5 5h10M5 10h10M5 15h6" />,
  };
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      {paths[tab]}
    </svg>
  );
};

const NavColumn: React.FC<{
  tab: Tab;
  onTab: (t: Tab) => void;
  state: Readonly<PlayerState>;
}> = ({ tab, onTab, state }) => {
  const items: [Tab, string][] = [
    ['semester', home['nav-semester']],
    ['folder', home['nav-folder']],
    ['stats', home['nav-stats']],
    ['log', home['nav-log']],
  ];
  const timeline = home['timeline'].split('｜');
  const currentIdx = state.semester === 'prologue' ? 0 : 1; // demo 只到大一上
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-col gap-1">
        {items.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onTab(key)}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-left text-[15px] transition ${
              tab === key ? 'bg-ink font-medium text-paper' : 'text-ink hover:bg-line/60'
            }`}
          >
            <NavIcon tab={key} />
            {label}
            {key === 'folder' && state.archive.length > 0 && (
              <span className="ml-auto text-xs opacity-70">{state.archive.length}</span>
            )}
          </button>
        ))}
      </nav>
      <div>
        <div className="mb-2 px-1 text-[11px] tracking-widest text-ink-soft">
          {home['timeline-title']}
        </div>
        <ol className="flex flex-col gap-1 px-1">
          {timeline.map((t, i) => (
            <li
              key={t}
              className={`flex items-center gap-2 text-xs ${
                i === currentIdx ? 'font-semibold text-accent' : i < currentIdx ? 'text-ink' : 'text-ink-soft/50'
              }`}
            >
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  i === currentIdx ? 'bg-accent' : i < currentIdx ? 'bg-ink' : 'bg-line'
                }`}
              />
              {t}
              {i === currentIdx && <span className="text-[10px]">◀ {home['timeline-current']}</span>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};

// ---------- 本学期 ----------

const QuickResultModal: React.FC<{ qa: QuickAction; onClose: () => void }> = ({ qa, onClose }) => (
  <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-6">
    <div className="w-full max-w-md rounded-2xl bg-paper p-6 animate-fade-up">
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

const SemesterTab: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  const navigate = useNavigate();
  const runQuickAction = useEngine((s) => s.runQuickAction);
  const [lastQuick, setLastQuick] = useState<QuickAction | null>(null);
  const board = boards.y1s1;
  const qas = quickActions[board.quickActionsRef] ?? [];
  const mainlineDone = isMainlineComplete(state);
  const firstMainlineDone = state.completedActions.includes(board.mainline[0]?.id);

  if (state.semester === 'y1s1-end') {
    return <SemesterEnded />;
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title={home['mainline-title']} sub={home['mainline-sub']}>
        <ol className="flex flex-col gap-3">
          {board.mainline.map((m, i) => {
            const done = state.completedActions.includes(m.id);
            const unlocked = i === 0 || state.completedActions.includes(board.mainline[i - 1].id);
            return (
              <li
                key={m.id}
                className={`flex items-center gap-4 rounded-xl border p-4 ${
                  done ? 'border-line bg-paper opacity-70' : unlocked ? 'border-accent/50 bg-card' : 'border-line bg-paper opacity-45'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    done ? 'bg-ink text-paper' : unlocked ? 'bg-accent text-white' : 'bg-line text-ink-soft'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[16px] font-medium">{m.label}</span>
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">
                      {m.tag}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-ink-soft">{m.desc}</p>
                </div>
                {done ? (
                  <span className="text-xs text-ink-soft">{home['mainline-done-tag']}</span>
                ) : unlocked ? (
                  <Button onClick={() => navigate(`/level/${m.id}`)}>{home['mainline-enter']}</Button>
                ) : (
                  <span className="text-xs text-ink-soft">{board.mainlineLockText}</span>
                )}
              </li>
            );
          })}
        </ol>
      </Panel>

      <Panel title={home['electives-title']} sub={home['electives-sub']}>
        {!firstMainlineDone && (
          <p className="mb-3 text-sm text-accent">{board.electivesLockText}</p>
        )}
        <div className={`grid grid-cols-2 gap-3 ${firstMainlineDone ? '' : 'pointer-events-none opacity-40'}`}>
          {qas.map((qa) => {
            const cost = effectiveCost(qa.cost, qa.costWithAbility, state.abilities);
            const done = state.completedActions.includes(qa.id);
            const unaffordable = cost > state.actionPoints;
            return (
              <button
                key={qa.id}
                disabled={done || unaffordable}
                onClick={() => {
                  runQuickAction(qa);
                  window.setTimeout(() => setLastQuick(qa), 250);
                }}
                className={`rounded-xl border border-line bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-md disabled:hover:translate-y-0 disabled:hover:border-line disabled:hover:shadow-none ${
                  done ? 'opacity-55' : unaffordable ? 'opacity-40' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-medium">{qa.label}</span>
                  {done ? (
                    <span className="text-xs text-ink-soft">✓ {ui.board['completed-tag']}</span>
                  ) : (
                    <span className={`text-xs ${cost < qa.cost ? 'text-accent' : 'text-ink-soft'}`}>
                      {cost === 0 ? ui.board['free-tag'] : `${'●'.repeat(cost)} ${cost}${ui.board['cost-unit']}`}
                    </span>
                  )}
                </div>
                {cost < qa.cost && !done && (
                  <div className="mt-1 text-xs text-accent">{ui.board['discount-tag']}</div>
                )}
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="flex items-center justify-end gap-4">
        <span className="text-sm text-ink-soft">
          {mainlineDone ? home['settle-hint-ready'] : home['settle-hint-mainline']}
        </span>
        <Button disabled={!mainlineDone} onClick={() => navigate('/settlement')}>
          {home['settle-btn']}
        </Button>
      </div>

      {lastQuick && <QuickResultModal qa={lastQuick} onClose={() => setLastQuick(null)} />}
    </div>
  );
};

const SemesterEnded: React.FC = () => {
  const navigate = useNavigate();
  const reset = useEngine((s) => s.reset);
  const [confirming, setConfirming] = useState(false);
  return (
    <Panel>
      <div className="py-6 text-center">
        <h2 className="text-xl font-semibold">{home['demo-end-title']}</h2>
        <p className="mt-2 text-sm text-ink-soft">{home['demo-end-desc']}</p>
        <div className="mx-auto mt-6 flex max-w-xs flex-col gap-2">
          <Button onClick={() => navigate('/settlement')}>{home['view-ending']}</Button>
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            {home['restart']}
          </Button>
        </div>
      </div>
      {confirming && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-6">
          <div className="w-full max-w-sm rounded-2xl bg-paper p-6 animate-fade-up">
            <p className="text-[16px] font-medium">{home['restart-confirm']}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button full onClick={() => void reset()}>
                {home['restart-yes']}
              </Button>
              <Button variant="secondary" full onClick={() => setConfirming(false)}>
                {home['restart-no']}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
};

// ---------- 文件夹：作品集 / 提示词库 / 档案 ----------

const SectionHead: React.FC<{ title: string; sub: string; count: number }> = ({
  title,
  sub,
  count,
}) => (
  <header className="mb-3 mt-1 flex items-baseline gap-3">
    <h3 className="border-b-2 border-accent pb-1 text-[15px] font-semibold tracking-wide">
      {title}
    </h3>
    <span className="text-xs text-ink-soft">{sub}</span>
    {count > 0 && (
      <span className="ml-auto rounded-full bg-line px-2 py-0.5 text-[11px] text-ink-soft">
        {count}
      </span>
    )}
  </header>
);

/** 作品卡：横向堆叠的大图卡片 */
const WorkCard: React.FC<{ item: ArchiveItem; onOpen: () => void }> = ({ item, onOpen }) => {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      onClick={onOpen}
      className="w-[270px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-card text-left shadow-sm transition hover:-translate-y-1 hover:border-accent/50 hover:shadow-lg"
    >
      <div className="h-[180px] w-full overflow-hidden border-b border-line bg-paper">
        {item.assetRef && imgOk ? (
          <img
            src={`/assets/${item.assetRef}.svg`}
            alt=""
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl">🗂️</div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[14.5px] font-medium">{item.title}</span>
          {item.borrowed && (
            <span className="shrink-0 rounded bg-line px-1.5 py-0.5 text-[11px] text-ink-soft">
              {home['borrowed-tag']}
            </span>
          )}
        </div>
        {item.resumeLine && (
          <p className="mt-1 truncate text-xs text-ink-soft">{item.resumeLine}</p>
        )}
      </div>
    </button>
  );
};

/** 提示词模板卡：带槽位预览 */
const PromptCard: React.FC<{ item: ArchiveItem; onOpen: () => void }> = ({ item, onOpen }) => {
  const template = getLevelContent(item.levelId).copy['prompt-template'] ?? '';
  return (
    <button
      onClick={onOpen}
      className="break-inside-avoid overflow-hidden rounded-2xl border border-line bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md"
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
          ⚡ {home['prompt-badge']}
        </span>
        <span className="text-[14.5px] font-semibold">{item.title}</span>
      </div>
      <div className="relative max-h-24 overflow-hidden">
        <PromptText text={template} className="text-[12px] text-ink-soft" />
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
      </div>
    </button>
  );
};

/** 档案卡：信纸折角样式 */
const DocCard: React.FC<{ item: ArchiveItem; onOpen: () => void }> = ({ item, onOpen }) => (
  <button
    onClick={onOpen}
    className="relative break-inside-avoid overflow-hidden rounded-xl border border-line bg-card p-4 pr-8 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md"
  >
    <span className="absolute right-0 top-0 h-0 w-0 border-l-[18px] border-t-[18px] border-l-transparent border-t-line" />
    <div className="text-[14.5px] font-medium">{item.title}</div>
    <div className="mt-1 text-xs text-ink-soft">{boards.y1s1.header}</div>
  </button>
);

/** 详情弹层：完整内容，不做删减 */
const ArchiveDetail: React.FC<{
  item: ArchiveItem;
  state: Readonly<PlayerState>;
  onClose: () => void;
}> = ({ item, state, onClose }) => {
  const [copied, setCopied] = useState(false);
  const section = getFolderSection(item.id);
  const levelCopy = getLevelContent(item.levelId).copy;

  const copyTemplate = () => {
    const tpl = levelCopy['prompt-template'] ?? '';
    void navigator.clipboard?.writeText(tpl).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    });
  };

  const renderBody = () => {
    // 提示词模板：用途 + 全文（槽位高亮）+ 复制
    if (section === 'prompts') {
      return (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl bg-accent-soft/60 p-3.5 text-[13.5px] leading-relaxed">
            <span className="mr-2 font-semibold text-accent">{home['prompt-usage-label']}</span>
            {levelCopy['prompt-usage']}
          </div>
          <div className="rounded-xl border border-line bg-card p-4">
            <PromptText text={levelCopy['prompt-template'] ?? ''} className="text-[14px]" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-ink-soft">{home['prompt-slot-legend']}</span>
            <Button variant="secondary" onClick={copyTemplate}>
              {copied ? home['prompt-copied'] : home['prompt-copy']}
            </Button>
          </div>
        </div>
      );
    }
    // 专业卡片：完整五栏
    if (item.levelId === 'prologue') {
      const major = getMajor(state.player.majorId);
      const row = (label: string, body: React.ReactNode) => (
        <div className="border-t border-line py-2.5 first:border-t-0">
          <div className="text-[11px] tracking-widest text-ink-soft">{label}</div>
          <div className="mt-1 text-[14px] leading-relaxed">{body}</div>
        </div>
      );
      return (
        <div className="rounded-xl border border-accent/40 bg-card p-4">
          <div className="mb-2 text-lg font-semibold">{major.name}</div>
          {row(levelCopy['card-core-courses'], major.card.coreCourses.join(' · '))}
          {row(levelCopy['card-hardest'], major.card.hardestY1.join(' / '))}
          {row(levelCopy['card-gpa-killer'], major.card.gpaKiller)}
          {row(levelCopy['card-destinations'], major.card.destinations.join(' · '))}
          {row(levelCopy['card-secret'], <span className="text-accent">{major.card.secret}</span>)}
        </div>
      );
    }
    // 避坑清单：要点卡 + 三轮完整问答记录
    if (item.id === 'course-map') {
      return (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-accent/40 bg-card p-4">
            <div className="mb-2 text-[13px] font-semibold text-accent">
              {home['detail-summary']}
            </div>
            <ul className="space-y-2 text-[14px] leading-relaxed">
              {[1, 2, 3, 4, 5]
                .map((n) => levelCopy[`s6-card-line${n}`])
                .filter(Boolean)
                .map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-accent">✓</span>
                    {line}
                  </li>
                ))}
            </ul>
          </div>
          <h4 className="text-[13px] font-semibold tracking-widest text-ink-soft">
            {home['detail-full-record']}
          </h4>
          {([1, 2, 3] as const).map((n) => (
            <div key={n} className="flex flex-col gap-2">
              <div className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[13px] leading-relaxed text-paper">
                <span className="whitespace-pre-wrap">{levelCopy[`q${n}`]}</span>
              </div>
              <div className="rounded-2xl rounded-tl-md border border-line bg-card px-4 py-3">
                {renderMarkdown(levelCopy[`a${n}`] ?? '')}
              </div>
            </div>
          ))}
        </div>
      );
    }
    // 海报：双图 + 简历措辞
    if (item.levelId === 'poster' && item.assetRef) {
      const wideRef = item.assetRef.includes('senpai')
        ? 'poster-senpai-169'
        : item.assetRef.replace('-34-v2', '-169');
      return (
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-3">
            <img
              src={`/assets/${item.assetRef}.svg`}
              alt=""
              className="w-[42%] rounded-lg border border-line"
            />
            <img
              src={`/assets/${wideRef}.svg`}
              alt=""
              className="w-[56%] rounded-lg border border-line"
            />
          </div>
          {item.resumeLine && (
            <div className="rounded-xl bg-accent-soft/60 p-3.5 text-[13.5px]">
              <span className="mr-2 font-semibold text-accent">
                {home['detail-resume-line']}
              </span>
              {item.resumeLine}
            </div>
          )}
        </div>
      );
    }
    return item.assetRef ? (
      <img
        src={`/assets/${item.assetRef}.svg`}
        alt=""
        className="w-full rounded-lg border border-line"
      />
    ) : null;
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[88dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-paper p-6 animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-[17px] font-semibold">
            {section === 'prompts' ? '⚡' : '📁'} {item.title}
          </h3>
          <div className="flex items-center gap-2">
            {item.borrowed && (
              <span className="rounded bg-line px-1.5 py-0.5 text-[11px] text-ink-soft">
                {home['borrowed-tag']}
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink-soft hover:border-ink/40"
            >
              ✕
            </button>
          </div>
        </div>
        {renderBody()}
      </div>
    </div>
  );
};

const FolderTab: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  const [openItem, setOpenItem] = useState<ArchiveItem | null>(null);
  const works = state.archive.filter((a) => getFolderSection(a.id) === 'works');
  const prompts = state.archive.filter((a) => getFolderSection(a.id) === 'prompts');
  const docs = state.archive.filter((a) => getFolderSection(a.id) === 'docs');

  return (
    <Panel title={home['folder-title']} sub={home['folder-sub']}>
      {/* 作品集：横向堆叠大卡 */}
      <SectionHead
        title={home['folder-sec-works']}
        sub={home['folder-sec-works-sub']}
        count={works.length}
      />
      {works.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
          {home['folder-empty-works']}
        </p>
      ) : (
        <div className="flex snap-x gap-4 overflow-x-auto pb-2">
          {works.map((item) => (
            <WorkCard key={item.id} item={item} onOpen={() => setOpenItem(item)} />
          ))}
        </div>
      )}

      {/* 提示词库：瀑布流 */}
      <div className="mt-6">
        <SectionHead
          title={home['folder-sec-prompts']}
          sub={home['folder-sec-prompts-sub']}
          count={prompts.length}
        />
        {prompts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-soft">
            {home['folder-empty-prompts']}
          </p>
        ) : (
          <div className="columns-2 gap-3 [&>*]:mb-3 [&>*]:w-full">
            {prompts.map((item) => (
              <PromptCard key={item.id} item={item} onOpen={() => setOpenItem(item)} />
            ))}
          </div>
        )}
      </div>

      {/* 档案：瀑布流 */}
      {docs.length > 0 && (
        <div className="mt-6">
          <SectionHead
            title={home['folder-sec-docs']}
            sub={home['folder-sec-docs-sub']}
            count={docs.length}
          />
          <div className="columns-2 gap-3 [&>*]:mb-3 [&>*]:w-full">
            {docs.map((item) => (
              <DocCard key={item.id} item={item} onOpen={() => setOpenItem(item)} />
            ))}
          </div>
        </div>
      )}

      {openItem && (
        <ArchiveDetail item={openItem} state={state} onClose={() => setOpenItem(null)} />
      )}
    </Panel>
  );
};


const StatsTab: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => (
  <div className="flex flex-col gap-4">
    <Panel title={home['stats-title']}>
      <div className="flex flex-col gap-3">
        {VISIBLE_AXES.map((a) => (
          <AxisBar key={a} label={ui.axes[a]} value={state.axes[a]} />
        ))}
        <AxisBar label={ui.axes.energy} value={state.axes.energy} strong />
        <p className="text-xs text-ink-soft">{home['stats-energy-note']}</p>
      </div>
    </Panel>
    <Panel title={home['stats-abilities-title']}>
      {state.abilities.length === 0 ? (
        <p className="text-sm text-ink-soft">{home['stats-abilities-empty']}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {state.abilities.map((a) => (
            <span key={a} className="rounded-lg bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent">
              ⚡ {ui.abilities[a] ?? a}
            </span>
          ))}
        </div>
      )}
    </Panel>
  </div>
);

const LogTab: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => (
  <Panel title={home['log-title']}>
    {state.log.length === 0 ? (
      <p className="text-sm text-ink-soft">{home['log-empty']}</p>
    ) : (
      <ol className="flex flex-col gap-0.5">
        {[...state.log].reverse().map((entry, i) => (
          <li key={i} className="flex items-baseline gap-3 border-b border-line/60 py-2.5 last:border-b-0">
            <time className="shrink-0 text-xs tabular-nums text-ink-soft">
              {new Date(entry.ts).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </time>
            <span
              className={`text-sm leading-relaxed ${entry.type === 'semester' ? 'font-semibold' : ''}`}
            >
              {entry.text}
            </span>
          </li>
        ))}
      </ol>
    )}
  </Panel>
);

// ---------- 页面 ----------

export const HomePage: React.FC = () => {
  const state = useEngine((s) => s.state)!;
  const { email, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('semester');
  const major = getMajor(state.player.majorId);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-paper/95">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3.5">
          <div className="flex items-baseline gap-4">
            <span className="text-lg font-semibold tracking-widest">{ui['app-title']}</span>
            <span className="text-sm text-ink-soft">{boards.y1s1.header}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium">
              {interpolate(home['greeting'], {
                playerName: state.player.name,
                majorName: major.name,
              })}
            </span>
            {isCloudMode ? (
              <>
                <span className="text-xs text-ink-soft">{email}</span>
                <button
                  className="text-xs text-ink-soft underline underline-offset-4"
                  onClick={() => void signOut()}
                >
                  {(ui.auth as Record<string, string>)['logout']}
                </button>
              </>
            ) : (
              <span className="rounded bg-line px-2 py-0.5 text-xs text-ink-soft">
                {(ui.auth as Record<string, string>)['local-mode-title']}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1200px] grid-cols-[200px_minmax(0,1fr)_280px] gap-6 px-6 py-6">
        <NavColumn tab={tab} onTab={setTab} state={state} />
        <main className="animate-fade-up" key={tab}>
          {tab === 'semester' && <SemesterTab state={state} />}
          {tab === 'folder' && <FolderTab state={state} />}
          {tab === 'stats' && <StatsTab state={state} />}
          {tab === 'log' && <LogTab state={state} />}
        </main>
        <StatusRail state={state} />
      </div>
    </div>
  );
};
