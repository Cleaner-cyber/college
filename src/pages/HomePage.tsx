/**
 * Home 主界面（桌面端游戏 hub）：
 * 左侧导航（本学期/文件夹/属性/记录 + 四年时间轴）
 * 中间内容区（主线任务 / 选修行动板 / 档案 / 属性 / 记录）
 * 右侧状态栏（行动点 / 四轴 / 四年目标 / 已解锁能力）
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ArchiveItem, MajorDetail, PlayerState } from '@/contracts';
import {
  fetchMajorDetail,
  getBoard,
  getFolderSection,
  getLevelContent,
  getMajor,
  getSimEvents,
  getTrait,
  interpolate,
  tagDefs,
  ui,
} from '@/engine/content';
import { useEngine, effectiveCost, isMainlineComplete } from '@/engine/store';
import {
  awakenedTagIds,
  checkRate,
  conditionLabel,
  cumulativeGpa,
  drawableCount,
  evalCondition,
  semesterIndex,
  visibleActions,
} from '@/engine/sim';
import { getPath } from '@/engine/path';
import { CampusMap, levelLocationName } from '@/components/CampusMap';
import { useAuth } from '@/services/auth';
import { isCloudMode } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { PromptText } from '@/components/ui/Markdown';
import { DocViewer } from '@/components/ui/DocViewer';
import { HomeTour, TOUR_KEY } from '@/components/ui/Tour';
import { ActionResultModal, EventModal, simCopy, type EventOptionView } from '@/components/sim/EventModal';

const home = ui.home as Record<string, string>;
const VISIBLE_AXES = ['academic', 'portfolio', 'expression', 'cash'] as const;
const AXIS_MAX = 8;

/** 本学期课程（v2.6 GPA 系统）：按专业详情的分年课程表取当期一半（上/下学期各一半） */
const detailCache = new Map<string, MajorDetail | null>();

const CoursesPanel: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  const major = getMajor(state.player.majorId);
  const [detail, setDetail] = useState<MajorDetail | null>(detailCache.get(major.id) ?? null);
  React.useEffect(() => {
    if (detailCache.has(major.id)) return;
    let alive = true;
    void fetchMajorDetail(major.id).then((d) => {
      detailCache.set(major.id, d);
      if (alive) setDetail(d);
    });
    return () => {
      alive = false;
    };
  }, [major.id]);

  const si = semesterIndex(state.semester); // 1..7
  const yearKey = (['y1', 'y1', 'y2', 'y2', 'y3', 'y3', 'y4'] as const)[si - 1] ?? 'y1';
  const yearCourses = detail?.courses?.[yearKey] ?? [];
  const half = Math.ceil(yearCourses.length / 2);
  const courses =
    si === 7 ? yearCourses : si % 2 === 1 ? yearCourses.slice(0, half) : yearCourses.slice(half);

  return (
    <Panel title={home['courses-title']} sub={home['courses-sub']}>
      {courses.length === 0 ? (
        <p className="text-sm text-ink-soft">{home['courses-empty']}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {courses.map((c) => (
            <span key={c} className="rounded-lg border border-line bg-paper px-2.5 py-1 text-[13px]">
              📖 {c}
            </span>
          ))}
        </div>
      )}
    </Panel>
  );
};

/** 文件夹里的专业卡片：知识库速览行 + 按小节展开的全文（与序章共用同一份详情 JSON） */
const FolderMajorCard: React.FC<{ majorId: string; copy: Record<string, string> }> = ({
  majorId,
  copy,
}) => {
  const major = getMajor(majorId);
  const [detail, setDetail] = useState<MajorDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  React.useEffect(() => {
    let alive = true;
    void fetchMajorDetail(major.id).then((d) => {
      if (!alive) return;
      setDetail(d);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [major.id]);
  const card = detail?.card ?? {};
  const rows: [string, string | undefined][] = [
    [copy['card-positioning'], card.positioning ?? card.intro],
    [copy['card-fit'], card.fit],
    [copy['card-unfit'], card.unfit],
    [copy['card-pit'], card.pit],
    [copy['card-paths'], card.paths],
  ];
  return (
    <div className="rounded-xl border border-accent/40 bg-card p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-lg font-semibold">{major.name}</span>
        <span className="text-[11px] text-ink-soft">
          {major.group && `${major.group} · ${major.klass}`}
        </span>
      </div>
      {!loaded && <p className="py-3 text-center text-sm text-ink-soft">{copy['card-loading']}</p>}
      {loaded && !detail && (
        <p className="py-2 text-[14px] leading-relaxed text-ink-soft">{copy['card-generic-note']}</p>
      )}
      {loaded && detail && (
        <>
          {rows
            .filter(([, v]) => v)
            .map(([label, v]) => (
              <div key={label} className="border-t border-line py-2.5 first:border-t-0">
                <div className="text-[11px] tracking-widest text-ink-soft">{label}</div>
                <div className="mt-1 text-[13px] leading-relaxed">{v}</div>
              </div>
            ))}
          {detail.sections.length > 0 && (
            <div className="mt-3 border-t border-line pt-2">
              <div className="mb-1 text-[11px] tracking-widest text-ink-soft">
                {copy['card-detail-title']}
              </div>
              {detail.sections.map((s) => (
                <details key={s.title} className="border-b border-line/60 py-2 last:border-b-0">
                  <summary className="cursor-pointer select-none text-[14px] font-medium marker:text-accent">
                    {s.title}
                  </summary>
                  <div className="space-y-2 pt-2">
                    {s.body.split(/\n{2,}/).map((p, i) =>
                      p.trim().startsWith('### ') ? (
                        <h4 key={i} className="pt-1 text-[13px] font-semibold">
                          {p.trim().slice(4)}
                        </h4>
                      ) : (
                        <p key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed">
                          {p.trim()}
                        </p>
                      ),
                    )}
                  </div>
                </details>
              ))}
              <p className="pt-2 text-center text-[11px] text-ink-soft">{copy['card-detail-source']}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

/** 资产地址：assetRef 自带扩展名则原样用（真图 jpg/webp），否则按占位 SVG 处理 */
const assetUrl = (ref: string) => (ref.includes('.') ? `/assets/${ref}` : `/assets/${ref}.svg`);

/** AI 长文档型作品：点开直接进文档查看器（标题与正文取自来源关卡的内容 JSON） */
const DOC_ITEMS: Record<string, { titleKey: string; mdKey: string }> = {
  'doc-course-rules': { titleKey: 'doc1-title', mdKey: 'a1' },
  'doc-summer-plan': { titleKey: 'doc2-title', mdKey: 'a2' },
  'doc-ppt-outline': { titleKey: 'outline-doc-title', mdKey: 'outline-doc-md' },
  'doc-ppt-tools': { titleKey: 'tools-doc-title', mdKey: 'tools-doc-md' },
};

type Tab = 'semester' | 'folder' | 'stats' | 'log';

/** 行动板分组（调研实证三分类 + 搞钱/生活），标签页切换避免长列表 */
const ACTION_GROUPS = ['study', 'research', 'practice', 'work', 'life'] as const;
type ActionGroup = (typeof ACTION_GROUPS)[number];

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
            className={`inline-block h-4 w-4 rounded-full transition-colors ${
              i < state.actionPoints
                ? 'bg-accent shadow-glow animate-breathe'
                : 'border border-line bg-paper'
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
        <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
          <span className="text-xs text-ink-soft">🎓 {home['hud-gpa-label']}</span>
          <span className="text-[15px] font-semibold tabular-nums text-accent">
            {cumulativeGpa(state)?.toFixed(2) ?? home['hud-gpa-empty']}
          </span>
        </div>
      </div>
    </Panel>
    <Panel title={home['stats-flag-title']}>
      <dl className="grid grid-cols-1 gap-1.5 text-sm">
        {state.pathGoal && (
          <div className="flex items-baseline justify-between">
            <dt className="text-xs text-ink-soft">{home['hud-path-label']}</dt>
            <dd className="font-semibold text-accent">
              {getPath(state.pathGoal)?.icon} {getPath(state.pathGoal)?.name}
            </dd>
          </div>
        )}
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
    <Panel title={home['hud-persona-title']}>
      <PersonaChips state={state} />
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

/** 右栏「我的人设」：入学特质 + 已觉醒人设卡；养成中的显示进度点（像属性一样常驻可见） */
const PersonaChips: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  const awakened = awakenedTagIds(state.tags);
  const growing = tagDefs.filter((t) => !awakened.includes(t.id) && (state.tags[t.id] ?? 0) > 0);
  if (state.traits.length === 0 && awakened.length === 0 && growing.length === 0) {
    return <p className="text-xs leading-relaxed text-ink-soft">{home['hud-persona-empty']}</p>;
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {state.traits.map((id) => (
          <span key={id} className="rounded-lg border border-line bg-paper px-2 py-1 text-xs">
            {getTrait(id)?.name ?? id}
          </span>
        ))}
        {awakened.map((id) => (
          <span key={id} className="rounded-lg bg-accent-soft px-2 py-1 text-xs font-medium text-accent">
            ★ {tagDefs.find((t) => t.id === id)?.name ?? id}
          </span>
        ))}
      </div>
      {growing.length > 0 && (
        <div className="flex flex-col gap-1">
          {growing.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-[11px] text-ink-soft">
              <span>{t.name}</span>
              <span className="tabular-nums">
                {'●'.repeat(state.tags[t.id] ?? 0)}
                {'○'.repeat(Math.max(0, t.threshold - (state.tags[t.id] ?? 0)))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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
  const TL_IDX: Record<string, number> = {
    prologue: 0, y1s1: 1, 'y1s1-end': 1, y1s2: 2, 'y1s2-end': 2,
    y2s1: 3, y2s2: 4, y3s1: 5, y3s2: 6, y4: 7, 'grad-end': 8,
  };
  const currentIdx = TL_IDX[state.semester] ?? 1;
  return (
    <div className="flex flex-col gap-6">
      <nav className="flex flex-col gap-1">
        {items.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onTab(key)}
            className={`flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-left text-[15px] transition ${
              tab === key ? 'bg-ink font-medium text-paper shadow-soft' : 'text-ink hover:bg-line/60'
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
        <ol className="relative flex flex-col gap-1 px-1 before:absolute before:bottom-2 before:left-[6.5px] before:top-2 before:w-px before:bg-line">
          {timeline.map((t, i) => (
            <li
              key={t}
              className={`flex items-center gap-2 text-xs ${
                i === currentIdx ? 'font-semibold text-accent' : i < currentIdx ? 'text-ink' : 'text-ink-soft/50'
              }`}
            >
              <span
                className={`relative z-10 inline-block h-1.5 w-1.5 rounded-full ring-2 ring-paper ${
                  i === currentIdx ? 'bg-accent shadow-glow' : i < currentIdx ? 'bg-ink' : 'bg-line'
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

const SemesterTab: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  const navigate = useNavigate();
  const runSimAction = useEngine((s) => s.runSimAction);
  const closeActionResult = useEngine((s) => s.closeActionResult);
  const actionResult = useEngine((s) => s.actionResult);
  const drawSimEvent = useEngine((s) => s.drawSimEvent);
  const resolveSimEvent = useEngine((s) => s.resolveSimEvent);
  const closeSimEvent = useEngine((s) => s.closeSimEvent);
  const simEvent = useEngine((s) => s.simEvent);
  const simResolution = useEngine((s) => s.simResolution);
  const board = getBoard(state.semester);
  const actionViews = visibleActions(state);
  const [mapOpen, setMapOpen] = useState(false);
  const [actionGroup, setActionGroup] = useState<ActionGroup>('study');
  // 选中组因过滤变空时回退到第一个非空组
  const groupsWithItems = ACTION_GROUPS.filter((g) =>
    actionViews.some((v) => (v.action.group ?? 'life') === g),
  );
  const activeGroup = groupsWithItems.includes(actionGroup)
    ? actionGroup
    : (groupsWithItems[0] ?? 'life');
  const mainlineDone = isMainlineComplete(state);
  const firstMainlineDone = state.completedActions.includes(board.mainline[0]?.id);
  // 过日子：本学期事件池余量（含连锁）
  const drawable = drawableCount(state);
  const canDraw = drawable > 0 && state.actionPoints >= 1;
  const simOptionViews: EventOptionView[] = (simEvent?.options ?? []).map((o) => ({
    label: o.label,
    disabled: o.require ? !evalCondition(state, o.require) : false,
    requireHint: o.require
      ? simCopy('require-hint', { cond: conditionLabel(o.require) })
      : undefined,
    checkHint: o.check
      ? simCopy('check-hint', {
          axis: ui.axes[o.check.axis],
          rate: Math.round(checkRate(state.axes[o.check.axis], o.check.dc) * 100),
        })
      : undefined,
  }));

  if (state.semester === 'grad-end') {
    return <SemesterEnded />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* 出门 · 校园地图（v2.6 场景化：主线关卡从地图地标进入） */}
      {!mainlineDone && (
        <button
          onClick={() => setMapOpen(true)}
          className="flex items-center gap-4 rounded-2xl border border-accent/50 bg-card/85 p-4 text-left shadow-soft backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <span className="text-2xl">🗺️</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold">{home['map-open-btn']}</span>
            <span className="mt-0.5 block text-xs text-ink-soft">{home['map-open-sub']}</span>
          </span>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-white shadow-glow">
            {board.mainline.filter((m) => !state.completedActions.includes(m.id)).length}
          </span>
        </button>
      )}
      {mapOpen && (
        <CampusMap
          state={state}
          onClose={() => setMapOpen(false)}
          onEnter={(id) => {
            setMapOpen(false);
            navigate(`/level/${id}`);
          }}
        />
      )}
      <CoursesPanel state={state} />
      <div data-tour="mainline">
        <Panel title={home['mainline-title']} sub={home['mainline-sub']}>
        <ol className="flex flex-col gap-3">
          {board.mainline.map((m, i) => {
            const done = state.completedActions.includes(m.id);
            const unlocked = i === 0 || state.completedActions.includes(board.mainline[i - 1].id);
            return (
              <li
                key={m.id}
                className={`flex items-center gap-4 rounded-xl border p-4 transition ${
                  done
                    ? 'border-line bg-paper opacity-70'
                    : unlocked
                      ? 'border-accent/50 bg-card shadow-soft'
                      : 'border-line bg-paper opacity-45'
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    done
                      ? 'bg-ink text-paper'
                      : unlocked
                        ? 'bg-accent text-white shadow-glow'
                        : 'bg-line text-ink-soft'
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
                    {levelLocationName(m.id) && (
                      <span className="rounded bg-paper px-1.5 py-0.5 text-[11px] text-ink-soft">
                        {home['map-loc-prefix']}
                        {levelLocationName(m.id)}
                      </span>
                    )}
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
      </div>

      <div data-tour="electives">
        <Panel title={home['electives-title']} sub={home['electives-sub']}>
        {!firstMainlineDone && (
          <p className="mb-3 text-sm text-accent">{board.electivesLockText}</p>
        )}
        {/* 过日子：抽学期事件卡（模拟层 P0，仅配置了事件池的学期显示） */}
        {getSimEvents(state.semester).length > 0 && (
          <div
            className={`mb-3 flex items-center gap-4 rounded-xl border border-dashed p-4 transition ${
              firstMainlineDone && canDraw
                ? 'border-accent/60 bg-accent-soft/40'
                : 'border-line bg-paper opacity-70'
            } ${firstMainlineDone ? '' : 'pointer-events-none'}`}
          >
            <span className="text-2xl">🎲</span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">{simCopy('live-title')}</div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
                {simCopy('live-sub')}
              </p>
            </div>
            <Button disabled={!canDraw} onClick={() => drawSimEvent()}>
              {state.actionPoints < 1
                ? simCopy('no-points')
                : drawable === 0
                  ? simCopy('pool-empty')
                  : simCopy('draw-btn')}
            </Button>
          </div>
        )}
        {/* 分组标签页 + 三列紧凑瓦片 + hover 渐进披露（调研：避免无尽滚动，卡面只留关键属性） */}
        <div className={firstMainlineDone ? '' : 'pointer-events-none opacity-40'}>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {ACTION_GROUPS.map((group) => {
              const items = actionViews.filter(({ action }) => (action.group ?? 'life') === group);
              if (items.length === 0) return null;
              const doable = items.filter(
                (v) =>
                  !v.locked &&
                  !v.done &&
                  effectiveCost(v.action.cost, v.action.costWithAbility, state.abilities) <=
                    state.actionPoints,
              ).length;
              return (
                <button
                  key={group}
                  onClick={() => setActionGroup(group)}
                  className={`rounded-full px-3 py-1.5 text-[12.5px] transition ${
                    activeGroup === group
                      ? 'bg-ink font-medium text-paper shadow-soft'
                      : 'border border-line bg-card text-ink-soft hover:border-accent/40 hover:text-ink'
                  }`}
                >
                  {simCopy(`group-${group}`)}
                  {doable > 0 && (
                    <span className={`ml-1 tabular-nums ${activeGroup === group ? 'text-paper/70' : 'text-accent'}`}>
                      {doable}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {actionViews
              .filter(({ action }) => (action.group ?? 'life') === activeGroup)
              .map(({ action, locked, done, times }) => {
                const cost = effectiveCost(action.cost, action.costWithAbility, state.abilities);
                const unaffordable = cost > state.actionPoints;
                return (
                  <button
                    key={action.id}
                    data-action-tile
                    disabled={locked || done || unaffordable}
                    onClick={() => runSimAction(action)}
                    className={`group relative flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2.5 text-left shadow-soft transition hover:z-30 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lift disabled:hover:translate-y-0 disabled:hover:border-line disabled:hover:shadow-soft ${
                      done ? 'opacity-50' : locked ? 'opacity-60' : unaffordable ? 'opacity-40' : ''
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper text-lg">
                      {locked ? '🔒' : (action.icon ?? '📌')}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium leading-tight">
                        {action.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-ink-soft">
                        {done
                          ? `✓ ${ui.board['completed-tag']}`
                          : cost === 0
                            ? ui.board['free-tag']
                            : `${'●'.repeat(cost)} ${cost}${ui.board['cost-unit']}`}
                        {times > 0 && (
                          <span className="ml-1.5 text-accent">
                            {interpolate((ui.sim as Record<string, string>)['times-tag'], { n: times })}
                          </span>
                        )}
                        {cost < action.cost && !done && !locked && ' ⚡'}
                      </span>
                    </span>
                    {/* hover 浮层：描述 / 解锁条件（渐进披露） */}
                    <span className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-64 rounded-xl bg-ink p-3 text-[12px] leading-relaxed text-paper shadow-pop group-hover:block">
                      {locked ? `🔒 ${action.lockedHint}` : action.desc}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </Panel>
      </div>

      <div className="flex items-center justify-end gap-4" data-tour="settle">
        <span className="text-sm text-ink-soft">
          {mainlineDone ? home['settle-hint-ready'] : home['settle-hint-mainline']}
        </span>
        <Button disabled={!mainlineDone} onClick={() => navigate('/settlement')}>
          {home['settle-btn']}
        </Button>
      </div>

      {actionResult && <ActionResultModal res={actionResult} onClose={closeActionResult} />}
      {simEvent && (
        <EventModal
          event={simEvent}
          options={simOptionViews}
          resolution={simResolution}
          onPick={resolveSimEvent}
          onClose={closeSimEvent}
        />
      )}
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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl bg-paper p-6 shadow-pop animate-pop-in">
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
      className="w-[270px] shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-card text-left shadow-soft transition hover:-translate-y-1 hover:border-accent/50 hover:shadow-lift"
    >
      <div className="h-[180px] w-full overflow-hidden border-b border-line bg-paper">
        {item.assetRef && imgOk ? (
          <img
            src={assetUrl(item.assetRef)}
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

/** 提示词模板卡：紧凑行卡（模板全文点进详情看） */
const PromptCard: React.FC<{ item: ArchiveItem; onOpen: () => void }> = ({ item, onOpen }) => (
  <button
    onClick={onOpen}
    className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-card p-4 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lift"
  >
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl">
      ⚡
    </span>
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-2">
        <span className="truncate text-[14.5px] font-semibold">{item.title}</span>
        <span className="shrink-0 rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
          {home['prompt-badge']}
        </span>
      </span>
      <span className="mt-0.5 block truncate text-xs text-ink-soft">
        {home['prompt-open-hint']}
      </span>
    </span>
    <span className="shrink-0 text-ink-soft">›</span>
  </button>
);

/** 档案卡：信纸折角样式 */
const DocCard: React.FC<{ item: ArchiveItem; onOpen: () => void }> = ({ item, onOpen }) => (
  <button
    onClick={onOpen}
    className="relative break-inside-avoid overflow-hidden rounded-xl border border-line bg-card p-4 pr-8 text-left shadow-soft transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lift"
  >
    <span className="absolute right-0 top-0 h-0 w-0 border-l-[18px] border-t-[18px] border-l-transparent border-t-line" />
    <div className="text-[14.5px] font-medium">{item.title}</div>
    <div className="mt-1 text-xs text-ink-soft">{getBoard(item.semester).header}</div>
  </button>
);

/** 详情弹层：完整内容，不做删减 */
const ArchiveDetail: React.FC<{
  item: ArchiveItem;
  state: Readonly<PlayerState>;
  onClose: () => void;
}> = ({ item, state, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [openDoc, setOpenDoc] = useState<1 | 2 | null>(null);
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
    // 专业卡片：知识库速览 + 可展开全文（v2.5）
    if (item.levelId === 'prologue') {
      return <FolderMajorCard majorId={state.player.majorId} copy={levelCopy} />;
    }
    // 避坑清单：要点卡 + 两轮对话记录（长文档以卡片入口打开文档查看器）
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
          {([1, 2] as const).map((n) => (
            <div key={n} className="flex flex-col gap-2.5">
              <div className="ml-auto max-w-[88%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[13px] leading-relaxed text-paper">
                {levelCopy[`q${n}`]}
              </div>
              <button
                onClick={() => setOpenDoc(n)}
                className="flex w-[360px] max-w-full items-center gap-3 rounded-2xl rounded-tl-md border border-accent/40 bg-card p-3.5 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl">
                  📄
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">
                    {levelCopy[`doc${n}-title`]}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-accent">
                    {(ui.doc as Record<string, string>)['open-hint']}
                  </span>
                </span>
                <span className="shrink-0 text-ink-soft">›</span>
              </button>
            </div>
          ))}
        </div>
      );
    }
    // 作品（海报/PPT 等）：大图 + 简历措辞
    return item.assetRef ? (
      <div className="flex flex-col gap-4">
        <img
          src={assetUrl(item.assetRef)}
          alt=""
          className="mx-auto max-h-[62dvh] w-auto max-w-full rounded-lg border border-line"
        />
        {item.resumeLine && (
          <div className="rounded-xl bg-accent-soft/60 p-3.5 text-[13.5px]">
            <span className="mr-2 font-semibold text-accent">{home['detail-resume-line']}</span>
            {item.resumeLine}
          </div>
        )}
      </div>
    ) : null;
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-paper shadow-pop animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 固定头部：标题 + 关闭（不随内容滚动） */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-paper/80 px-6 py-3.5">
          <h3 className="truncate text-[16px] font-semibold">
            {section === 'prompts' ? '⚡' : '📁'} {item.title}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            {item.borrowed && (
              <span className="rounded bg-line px-1.5 py-0.5 text-[11px] text-ink-soft">
                {home['borrowed-tag']}
              </span>
            )}
            <button
              onClick={onClose}
              className="rounded-full border border-line bg-card px-3 py-1 text-xs text-ink-soft transition hover:border-accent/50 hover:text-ink"
            >
              ✕ {(ui.doc as Record<string, string>)['close']}
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-6">{renderBody()}</div>
      </div>

      {openDoc && (
        <div onClick={(e) => e.stopPropagation()}>
          <DocViewer
            title={levelCopy[`doc${openDoc}-title`] ?? ''}
            md={levelCopy[`a${openDoc}`] ?? ''}
            onClose={() => setOpenDoc(null)}
          />
        </div>
      )}
    </div>
  );
};

const FolderTab: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  const [openItem, setOpenItem] = useState<ArchiveItem | null>(null);
  const [openDocItem, setOpenDocItem] = useState<ArchiveItem | null>(null);
  const works = state.archive.filter((a) => getFolderSection(a.id) === 'works');
  const prompts = state.archive.filter((a) => getFolderSection(a.id) === 'prompts');
  const docs = state.archive.filter((a) => getFolderSection(a.id) === 'docs');

  // AI 长文档型作品 → 文档查看器；其余 → 常规详情弹窗
  const open = (item: ArchiveItem) =>
    DOC_ITEMS[item.id] ? setOpenDocItem(item) : setOpenItem(item);

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
            <WorkCard key={item.id} item={item} onOpen={() => open(item)} />
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
          <div className="grid grid-cols-2 gap-3">
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
      {openDocItem && DOC_ITEMS[openDocItem.id] && (
        <DocViewer
          title={getLevelContent(openDocItem.levelId).copy[DOC_ITEMS[openDocItem.id].titleKey] ?? openDocItem.title}
          md={getLevelContent(openDocItem.levelId).copy[DOC_ITEMS[openDocItem.id].mdKey] ?? ''}
          onClose={() => setOpenDocItem(null)}
        />
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
    {state.traits.length > 0 && (
      <Panel title={home['stats-traits-title']}>
        <div className="flex flex-col gap-2.5">
          {state.traits.map((id) => {
            const t = getTrait(id);
            if (!t) return null;
            return (
              <div key={id} className="rounded-xl border border-line bg-card px-3.5 py-2.5">
                <span className="text-sm font-semibold">{t.name}</span>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{t.desc}</p>
              </div>
            );
          })}
        </div>
      </Panel>
    )}
    <Panel title={home['stats-tags-title']}>
      {Object.keys(state.tags).length === 0 ? (
        <p className="text-sm text-ink-soft">{home['stats-tags-empty']}</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tagDefs
            .filter((t) => (state.tags[t.id] ?? 0) > 0)
            .sort((a, b) => (state.tags[b.id] ?? 0) - (state.tags[a.id] ?? 0))
            .map((t) => {
              const n = state.tags[t.id] ?? 0;
              const awakened = n >= t.threshold;
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <span className={`w-16 shrink-0 text-sm ${awakened ? 'font-semibold text-accent' : ''}`}>
                    {t.name}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${awakened ? 'bg-accent' : 'bg-ink/60'}`}
                      style={{ width: `${Math.min(100, (n / t.threshold) * 100)}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-xs tabular-nums text-ink-soft">
                    {awakened ? `✦ ${home['stats-tags-awakened']}` : `${n}/${t.threshold}`}
                  </span>
                </div>
              );
            })}
        </div>
      )}
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
  // 首次进入 Home 自动播放新手引导（可跳过；顶栏可重看）
  const [tourOpen, setTourOpen] = useState(
    () => state.semester === 'y1s1' && !localStorage.getItem(TOUR_KEY),
  );
  const major = getMajor(state.player.majorId);

  return (
    <div className="min-h-dvh">
      {/* 宿舍场景背景（v2.6 场景化）：所有面板半透明叠在上面 */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <img src="/assets/bg-dorm.svg" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-paper/45" />
      </div>
      <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3.5">
          <div className="flex items-baseline gap-4">
            <span className="text-lg font-semibold tracking-widest">{ui['app-title']}</span>
            <span className="text-sm text-ink-soft">{getBoard(state.semester).header}</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {state.semester === 'y1s1' && (
              <button
                className="rounded-full border border-line bg-card px-2.5 py-1 text-xs text-ink-soft transition hover:border-accent hover:text-accent"
                onClick={() => {
                  setTab('semester');
                  setTourOpen(true);
                }}
              >
                ？{(ui.tour as Record<string, string>)['replay']}
              </button>
            )}
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
        <div data-tour="nav">
          <NavColumn tab={tab} onTab={setTab} state={state} />
        </div>
        <main className="animate-fade-up" key={tab}>
          {tab === 'semester' && <SemesterTab state={state} />}
          {tab === 'folder' && <FolderTab state={state} />}
          {tab === 'stats' && <StatsTab state={state} />}
          {tab === 'log' && <LogTab state={state} />}
        </main>
        <div data-tour="rail">
          <StatusRail state={state} />
        </div>
      </div>

      {tourOpen && <HomeTour onClose={() => setTourOpen(false)} />}
    </div>
  );
};
