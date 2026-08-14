/**
 * Home 主界面（桌面端游戏 hub）：
 * 左侧导航（本学期/文件夹/属性/记录 + 四年时间轴）
 * 中间内容区（主线任务 / 选修行动板 / 档案 / 属性 / 记录）
 * 右侧状态栏（行动点 / 四轴 / 四年目标 / 已解锁能力）
 */
import React, { useMemo, useState } from 'react';
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
import { DormScene } from '@/components/DormScene';
import { useAuth } from '@/services/auth';
import { isCloudMode } from '@/services/supabase';
import { Button } from '@/components/ui/Button';
import { spotlightMove } from '@/components/fx/spotlight';
import { Panel } from '@/components/ui/Panel';
import { PromptText } from '@/components/ui/Markdown';
import { DocViewer } from '@/components/ui/DocViewer';
import { HomeTour, TOUR_KEY } from '@/components/ui/Tour';
import { ActionResultModal, EventModal, simCopy, type EventOptionView } from '@/components/sim/EventModal';
import {
  BarChart3,
  BedDouble,
  BookOpen,
  Bug,
  ChartColumn,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  ClipboardCheck,
  CodeXml,
  Compass,
  Copy,
  Dices,
  FileText,
  FolderOpen,
  GraduationCap,
  IdCard,
  Image as ImageIcon,
  Lock,
  Mail,
  MessagesSquare,
  Mic,
  Presentation,
  Sparkles,
  Zap,
  Map as MapIcon,
  NotebookPen,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';

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
        <p className="text-sm text-cream-soft">{home['courses-empty']}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {courses.map((c) => (
            <span key={c} className="flex items-center gap-1.5 rounded-lg border border-line bg-paper px-2.5 py-1 text-[13px] text-ink">
              <BookOpen size={13} strokeWidth={1.75} className="text-accent" /> {c}
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
    <div className="rounded-xl border border-accent/40 bg-card p-4 text-ink">
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
const DOC_ITEMS: Record<string, { titleKey: string; mdKey: string; level?: string }> = {
  'doc-course-rules': { titleKey: 'doc1-title', mdKey: 'a1' },
  'doc-summer-plan': { titleKey: 'doc2-title', mdKey: 'a2' },
  'doc-ppt-outline': { titleKey: 'outline-doc-title', mdKey: 'outline-doc-md' },
  'doc-ppt-tools': { titleKey: 'tools-doc-title', mdKey: 'tools-doc-md' },
  // 速结行动发放的知识文档：levelId 是 action:xxx，文案源固定指到 library
  'contest-map-doc': { titleKey: 'contest-map-title', mdKey: 'contest-map-md', level: 'library' },
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
    <span className="w-8 shrink-0 text-right text-xs text-cream-soft">{label}</span>
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream/15">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${strong ? 'bg-ember' : 'bg-cream-soft'}`}
        style={{ width: `${Math.max(0, Math.min(100, (value / AXIS_MAX) * 100))}%` }}
      />
    </div>
    <span className="w-4 text-right text-xs font-semibold text-cream">{value}</span>
  </div>
);

/** 顶栏 HUD 数值条（留学模拟器式）：行动点 / 五轴 / 绩点 / 出路，一条看全 */
const HudStrip: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  const gpa = cumulativeGpa(state);
  const path = getPath(state.pathGoal);
  return (
    /* 窄屏只留 行动点/精力/绩点（五轴与出路在属性面板都有），避免逐字换行的灾难 */
    <div className="flex min-w-0 items-center gap-x-3 font-display text-[13px] md:flex-wrap md:gap-x-5 md:gap-y-1">
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-xs text-cream-soft">{home['action-points']}</span>
        {Array.from({ length: 3 }).map((_, i) => (
          <span
            key={i}
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              i < state.actionPoints ? 'bg-ember shadow-ember-glow' : 'bg-cream/15'
            }`}
          />
        ))}
      </span>
      {VISIBLE_AXES.map((a) => (
        <span key={a} className="hidden items-baseline gap-1 md:flex">
          <span className="text-xs text-cream-soft">{ui.axes[a]}</span>
          <span className="font-sans font-semibold tabular-nums text-cream">{state.axes[a]}</span>
        </span>
      ))}
      <span className="flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-xs text-cream-soft">{ui.axes.energy}</span>
        <span className="font-sans font-semibold tabular-nums text-ember">{state.axes.energy}</span>
      </span>
      <span className="flex items-baseline gap-1 whitespace-nowrap">
        <span className="text-xs text-cream-soft">{home['hud-gpa-label']}</span>
        <span className="font-sans font-semibold tabular-nums text-ember">
          {gpa?.toFixed(2) ?? home['hud-gpa-empty']}
        </span>
      </span>
      {path && (
        <span className="hidden items-baseline gap-1 md:flex">
          <span className="text-xs text-cream-soft">{home['hud-path-label']}</span>
          <span className="font-semibold text-cream">
            {path.icon} {path.name}
          </span>
        </span>
      )}
    </div>
  );
};

/** 场景热点：底图上的可点击地标（图钉圆标 + 标签 + 角标）——「底图 + 按钮」式主页的基本件 */
const SceneChip: React.FC<{
  x: number;
  y: number;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  active?: boolean;
  disabled?: boolean;
  tour?: string;
  onClick: () => void;
}> = ({ x, y, icon, label, badge, active = false, disabled = false, tour, onClick }) => (
  <div
    className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
    style={{ left: `${x}%`, top: `${y}%` }}
    data-tour={tour}
  >
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4 shadow-glass backdrop-blur-md backdrop-saturate-125 transition ${
        disabled
          ? 'border-cream/10 bg-dusk/55 text-cream-soft/50'
          : 'border-cream/25 bg-gradient-to-b from-dusk-2/85 to-dusk/90 text-cream hover:-translate-y-0.5 hover:border-ember/60'
      }`}
    >
      <span
        className={`relative flex h-8 w-8 items-center justify-center rounded-full text-[15px] ${
          active
            ? 'animate-ember-breathe bg-gradient-to-b from-ember to-ember-deep text-dusk shadow-ember-glow'
            : 'border border-cream/20 bg-cream/10'
        }`}
      >
        {icon}
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ember px-1 text-[10px] font-bold text-dusk shadow-soft">
            {badge}
          </span>
        )}
      </span>
      <span className="whitespace-nowrap font-display text-[14px] font-medium tracking-wide">{label}</span>
    </button>
  </div>
);

// ---------- 四年时间轴（属性页展示） ----------

/** 角色立绘卡（v3.0 角色面板）：玩家形象 + 名字/专业 + 四年目标速览。
 * 立绘资产 avatar-player.jpg 未就位时回退首字徽章（铁律 5：同名替换即可换真图）。 */
const PortraitCard: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  const [imgOk, setImgOk] = useState(true);
  const major = getMajor(state.player.majorId);
  const path = state.pathGoal ? getPath(state.pathGoal) : null;
  const goals: [string, React.ReactNode][] = [
    [home['hud-gpa-label'], cumulativeGpa(state)?.toFixed(2) ?? home['hud-gpa-empty']],
    [home['stats-flag-salary'], state.flag.salaryBand],
    [home['stats-flag-city'], state.flag.city],
    [home['stats-flag-work'], state.flag.workStyle],
    [home['stats-flag-time'], state.flag.offTime],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-cream/12 bg-dusk/80 shadow-glass backdrop-blur-md backdrop-saturate-125">
      <div className="relative h-[220px]">
        {imgOk ? (
          <img
            src="/assets/avatar-player.jpg"
            alt=""
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover object-top"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-b from-dusk-2/70 to-dusk/60">
            <span className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-ember/50 bg-ember/15 font-display text-4xl text-ember shadow-glow">
              {state.player.name.slice(0, 1)}
            </span>
          </div>
        )}
        {/* 底部渐隐压名牌：名字/专业叠在立绘上，不另占版面 */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-dusk/95 via-dusk/60 to-transparent px-4 pb-3 pt-12">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-display text-[17px] font-bold text-cream">
              {state.player.name}
            </span>
            {path && (
              <span className="shrink-0 text-xs font-semibold text-ember">
                {path.icon} {path.name}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-cream-soft">{major?.name ?? state.player.majorId}</div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3 text-[11.5px]">
        {goals.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2">
            <dt className="text-cream-soft/80">{k}</dt>
            <dd className="truncate font-medium text-cream">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/** 词条墙（v3.1）：稀有度按词条本质分级，与来源无关——
 * 金=传说（内核与价值观、上一世的馈赠）、紫=史诗（强能力/强条件）、
 * 蓝=普通（习惯与日常）、红=反面词条。词条只留名字，说明与进度进 hover 浮层。 */
const ENTRY_TIERS = {
  gold: 'border-tier-gold/60 text-[#EACF8F] shadow-[0_0_10px_rgba(217,179,106,0.22)]',
  purple: 'border-tier-purple/60 text-[#C9B3DE] shadow-[0_0_10px_rgba(169,143,192,0.22)]',
  blue: 'border-tier-blue/50 text-[#A5C1D6]',
  red: 'border-tier-red/55 text-[#DFA095]',
} as const;
type EntryTier = keyof typeof ENTRY_TIERS;
const TIER_ORDER: EntryTier[] = ['gold', 'purple', 'blue', 'red'];
const ENTRY_TIER: Record<string, EntryTier> = {
  // 入学人设
  'small-town': 'gold',
  artsy: 'gold',
  pragmatic: 'gold',
  'legacy-scholar': 'gold',
  'legacy-maker': 'gold',
  'legacy-voice': 'gold',
  'legacy-hustle': 'gold',
  'legacy-ease': 'gold',
  'well-off': 'purple',
  'social-king': 'purple',
  athlete: 'purple',
  'thick-skin': 'purple',
  'night-owl': 'blue',
  grinder: 'blue',
  homesick: 'blue',
  perfectionist: 'blue',
  shy: 'red',
  // 后天轨迹
  voice: 'purple',
  maker: 'purple',
  lone: 'blue',
  grind: 'blue',
  night: 'blue',
  social: 'blue',
  thrift: 'blue',
  nice: 'red',
};

const EntryChip: React.FC<{
  tier: EntryTier;
  name: string;
  desc: string;
  dim?: boolean; // 养成中（未觉醒）：同稀有度但暗显
}> = ({ tier, name, desc, dim = false }) => (
  <span
    tabIndex={0}
    className={`group relative inline-flex cursor-default items-center gap-1.5 rounded-lg border bg-dusk-2/70 px-2.5 py-1.5 text-[12.5px] font-medium outline-none ${ENTRY_TIERS[tier]} ${
      dim ? 'border-dashed opacity-55 shadow-none' : ''
    }`}
  >
    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
    {name}
    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 rounded-xl border border-cream/15 bg-dusk/95 p-2.5 text-left text-[11.5px] font-normal leading-relaxed text-cream opacity-0 shadow-glass backdrop-blur-md transition duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
      {desc}
    </span>
  </span>
);

const EntryChips: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  // 词条墙只放入学人设（金/紫/蓝/红按本质分级）；后天轨迹进下方的觉醒树
  const traits = state.traits
    .map((id) => getTrait(id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));
  if (traits.length === 0) {
    return <p className="text-sm text-cream-soft">{home['stats-tags-empty']}</p>;
  }
  const entries = traits
    .map((t) => ({ id: t.id, name: t.name, desc: t.desc, tier: ENTRY_TIER[t.id] ?? 'blue' }))
    .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((e) => (
        <EntryChip key={e.id} tier={e.tier} name={e.name} desc={e.desc} />
      ))}
    </div>
  );
};

/** 人设轨迹·觉醒树（v3.2）：八条轨迹围成星环，中心是「我」。
 * 每个节点带进度环（琥珀弧随计数增长），觉醒时按词条稀有度整环点亮并连线到中心；
 * 未开始的暗显。说明与进度全部进 hover 浮层。 */
const TIER_HEX: Record<EntryTier, string> = {
  gold: '#D9B36A',
  purple: '#A98FC0',
  blue: '#7FA3BD',
  red: '#C0574A',
};
const AWAKEN_W = 300;
const AWAKEN_H = 252;

const AwakeningTree: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  const cx = AWAKEN_W / 2;
  const cy = AWAKEN_H / 2;
  const rx = 112;
  const ry = 88;
  const R = 16; // 进度环半径
  const C = 2 * Math.PI * R;
  const nodes = tagDefs.map((t, i) => {
    const ang = (Math.PI * 2 * i) / tagDefs.length - Math.PI / 2;
    return { t, x: cx + rx * Math.cos(ang), y: cy + ry * Math.sin(ang) };
  });
  return (
    <div className="relative mx-auto" style={{ width: AWAKEN_W, height: AWAKEN_H }}>
      <svg
        aria-hidden
        className="absolute inset-0"
        width={AWAKEN_W}
        height={AWAKEN_H}
        viewBox={`0 0 ${AWAKEN_W} ${AWAKEN_H}`}
      >
        {nodes.map(({ t, x, y }) => {
          const n = state.tags[t.id] ?? 0;
          const awakened = n >= t.threshold;
          const frac = Math.min(1, n / t.threshold);
          const tier = TIER_HEX[ENTRY_TIER[t.id] ?? 'blue'];
          return (
            <g key={t.id}>
              {/* 中心连线：觉醒才点亮 */}
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke={awakened ? tier : '#F6E7CC'}
                strokeOpacity={awakened ? 0.55 : 0.1}
                strokeWidth={awakened ? 1.5 : 1}
              />
              {/* 进度环：底环 + 进度弧（觉醒后整环换稀有度色） */}
              <circle cx={x} cy={y} r={R} fill="none" stroke="#F6E7CC" strokeOpacity={0.14} strokeWidth={3} />
              {frac > 0 && (
                <circle
                  cx={x}
                  cy={y}
                  r={R}
                  fill="none"
                  stroke={awakened ? tier : '#FFB35C'}
                  strokeOpacity={awakened ? 0.95 : 0.8}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={`${frac * C} ${C}`}
                  transform={`rotate(-90 ${x} ${y})`}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* 中心：我 */}
      <div
        className="absolute flex h-11 w-11 items-center justify-center rounded-full border-2 border-ember/60 bg-dusk-2/80 font-display text-[15px] text-ember shadow-glow"
        style={{ left: cx - 22, top: cy - 22 }}
      >
        {state.player.name.slice(0, 1)}
      </div>

      {/* 轨迹节点（热区 + 名字 + hover 浮层） */}
      {nodes.map(({ t, x, y }) => {
        const n = state.tags[t.id] ?? 0;
        const awakened = n >= t.threshold;
        const started = n > 0;
        const tierKey = ENTRY_TIER[t.id] ?? 'blue';
        const desc = awakened
          ? t.awakenText
          : `${t.awakenText}｜${interpolate(home['entry-progress'], { n, threshold: t.threshold })}`;
        return (
          <div
            key={t.id}
            tabIndex={0}
            className="group absolute flex flex-col items-center outline-none"
            style={{ left: x - 30, top: y - 17, width: 60 }}
          >
            <span
              className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[11px] font-medium ${
                awakened ? '' : started ? 'text-cream' : 'text-cream-soft/40'
              }`}
              style={awakened ? { color: TIER_HEX[tierKey] } : undefined}
            >
              {awakened ? '✦' : n > 0 ? n : ''}
            </span>
            <span
              className={`mt-0.5 whitespace-nowrap text-[10.5px] ${
                awakened ? 'font-semibold' : started ? 'text-cream-soft' : 'text-cream-soft/40'
              }`}
              style={awakened ? { color: TIER_HEX[tierKey] } : undefined}
            >
              {t.name}
            </span>
            <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-52 -translate-x-1/2 rounded-xl border border-cream/15 bg-dusk/95 p-2.5 text-left text-[11.5px] leading-relaxed text-cream opacity-0 shadow-glass backdrop-blur-md transition duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
              {desc}
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ---------- 本学期 ----------

const SemesterTab: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  const navigate = useNavigate();
  const runSimAction = useEngine((s) => s.runSimAction);
  const drawSimEvent = useEngine((s) => s.drawSimEvent);
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
  if (state.semester === 'grad-end') {
    return <SemesterEnded />;
  }

  return (
    /* 单屏双栏（v3.3）：左=出门/主线/课程/结算，右=行动板。整页不出竖向滚动条 */
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,7fr)_minmax(0,6fr)]">
      <div className="flex flex-col gap-4">
      {/* 出门 · 校园地图（v2.6 场景化：主线关卡从地图地标进入） */}
      {!mainlineDone && (
        <button
          onClick={() => setMapOpen(true)}
          className="flex items-center gap-4 rounded-2xl border border-accent/50 bg-card/85 p-3.5 text-left text-ink shadow-soft backdrop-blur-md transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <span className="text-ember"><MapIcon size={26} strokeWidth={1.6} /></span>
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
      <div data-tour="mainline">
        <Panel title={home['mainline-title']} sub={home['mainline-sub']}>
        <ol className="flex flex-col gap-3">
          {board.mainline.map((m, i) => {
            const done = state.completedActions.includes(m.id);
            const unlocked = i === 0 || state.completedActions.includes(board.mainline[i - 1].id);
            return (
              <li
                key={m.id}
                className={`flex items-center gap-4 rounded-xl border p-4 text-ink transition ${
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
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="whitespace-nowrap text-[16px] font-medium">{m.label}</span>
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
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-ink-soft">{m.desc}</p>
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
      <CoursesPanel state={state} />
      <div className="flex items-center justify-end gap-4">
        <span className="text-sm text-cream-soft">
          {mainlineDone ? home['settle-hint-ready'] : home['settle-hint-mainline']}
        </span>
        <Button disabled={!mainlineDone} onClick={() => navigate('/settlement')}>
          {home['settle-btn']}
        </Button>
      </div>
      </div>

      <div data-tour="electives">
        <Panel title={home['electives-title']} sub={home['electives-sub']}>
        {!firstMainlineDone && (
          <p className="mb-3 text-sm text-accent">{board.electivesLockText}</p>
        )}
        {/* 过日子：抽学期事件卡（模拟层 P0，仅配置了事件池的学期显示） */}
        {getSimEvents(state.semester).length > 0 && (
          <div
            className={`mb-3 flex items-center gap-4 rounded-xl border border-dashed p-4 text-ink transition ${
              firstMainlineDone && canDraw
                ? 'border-accent/60 bg-accent-soft/40'
                : 'border-line-warm bg-paper/80'
            } ${firstMainlineDone ? '' : 'pointer-events-none'}`}
          >
            <span className="text-accent"><Dices size={26} strokeWidth={1.6} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">{simCopy('live-title')}</div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-soft">
                {simCopy('live-sub')}
              </p>
            </div>
            {/* 主线未完成时整块被 pointer-events-none 吞掉点击，按钮必须同步置灰并说明原因，
                否则它是一个满血样式却点不动的按钮——新手只会以为游戏卡了 */}
            <Button disabled={!canDraw || !firstMainlineDone} onClick={() => drawSimEvent()}>
              {!firstMainlineDone
                ? simCopy('locked-btn')
                : state.actionPoints < 1
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
          <div className="grid grid-cols-2 gap-2">
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
                    onMouseMove={spotlightMove}
                    className={`group relative flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2.5 text-left text-ink shadow-soft transition hover:z-30 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lift disabled:hover:translate-y-0 disabled:hover:border-line disabled:hover:shadow-soft ${
                      done ? 'opacity-50' : locked ? 'opacity-60' : unaffordable ? 'opacity-40' : 'fx-spotlight'
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
                    <span className="pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-64 rounded-xl bg-ink p-3 text-[12px] leading-relaxed text-paper shadow-pop group-focus-within:block group-hover:block">
                      {locked ? `🔒 ${action.lockedHint}` : action.desc}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </Panel>
      </div>
    </div>
  );
};

/** 模拟层弹窗（事件卡 / 行动结果）：挂在页面根层——不能嵌进 backdrop-blur 的面板浮层
 * （backdrop-filter 会劫持 fixed 定位的包含块，导致弹窗错位） */
const SimModals: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => {
  const closeActionResult = useEngine((s) => s.closeActionResult);
  const actionResult = useEngine((s) => s.actionResult);
  const resolveSimEvent = useEngine((s) => s.resolveSimEvent);
  const closeSimEvent = useEngine((s) => s.closeSimEvent);
  const simEvent = useEngine((s) => s.simEvent);
  const simResolution = useEngine((s) => s.simResolution);
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
  return (
    <>
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
    </>
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
        <p className="mt-2 text-sm text-cream-soft">{home['demo-end-desc']}</p>
        <div className="mx-auto mt-6 flex max-w-xs flex-col gap-2">
          <Button onClick={() => navigate('/settlement')}>{home['view-ending']}</Button>
          <Button variant="ghost" onClick={() => setConfirming(true)}>
            {home['restart']}
          </Button>
        </div>
      </div>
      {confirming && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl bg-paper p-6 text-ink shadow-pop animate-pop-in">
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

const SectionHead: React.FC<{ title: string; sub: string; count: number; total?: number }> = ({
  title,
  sub,
  count,
  total,
}) => (
  <header className="mb-3 mt-1 flex items-baseline gap-3">
    <h3 className="border-b-2 border-accent pb-1 text-[15px] font-semibold tracking-wide">
      {title}
    </h3>
    <span className="text-xs text-cream-soft">{sub}</span>
    {(count > 0 || total !== undefined) && (
      <span className="ml-auto rounded-full bg-cream/15 px-2 py-0.5 text-[11px] tabular-nums text-cream-soft">
        {total !== undefined ? `${count}/${total}` : count}
      </span>
    )}
  </header>
);

/** 作品卡：封面优先的大图卡片。真实图（jpg/webp/png）直接当封面；
 * 其余作品用 covers/cover-<id>.svg 专属封面（占位可同名替换，见 scripts/gen-covers.py）。
 * 简历措辞不再排在卡面上（详情里看），卡面只留封面+标题。 */
/** 已有用户生成封面的作品（cover-<id>.webp）；其余真图作品用 assetRef，兜底占位 SVG */
const GENERATED_COVERS = new Set([
  'doc-course-rules',
  'doc-summer-plan',
  'doc-ppt-outline',
  'ppt-deck',
  'homepage-v1',
  'dachuang-report',
  'gig-board',
  'resume-doc',
  'thesis-doc',
]);

/** 作品集卡牌图鉴（v3.5）：10 个作品位竖版卡牌、微扇形错角排开、横向滑动浏览；
 * 未获得的是暗卡剪影（hover 浮出解锁预告）。收藏卡册的手感。 */
const WORK_CODEX: { id: string; level: string; sem: string; icon: LucideIcon }[] = [
  { id: 'doc-course-rules', level: 'course-select', sem: 'y1s1', icon: FileText },
  { id: 'doc-summer-plan', level: 'course-select', sem: 'y1s1', icon: NotebookPen },
  { id: 'poster-y1', level: 'poster', sem: 'y1s1', icon: ImageIcon },
  { id: 'doc-ppt-outline', level: 'ppt', sem: 'y1s2', icon: ScrollText },
  { id: 'ppt-deck', level: 'ppt', sem: 'y1s2', icon: Presentation },
  { id: 'homepage-v1', level: 'coding', sem: 'y1s2', icon: CodeXml },
  { id: 'dachuang-report', level: 'dachuang', sem: 'y2s2', icon: ChartColumn },
  { id: 'gig-board', level: 'gig', sem: 'y2s2', icon: Clapperboard },
  { id: 'resume-doc', level: 'resume', sem: 'y3s1', icon: IdCard },
  { id: 'thesis-doc', level: 'thesis', sem: 'y4', icon: GraduationCap },
];

const workCover = (item: ArchiveItem) => {
  const raster = item.assetRef && /\.(jpe?g|png|webp)$/i.test(item.assetRef);
  return GENERATED_COVERS.has(item.id)
    ? `/assets/covers/cover-${item.id}.webp`
    : raster
      ? assetUrl(item.assetRef!)
      : `/assets/covers/cover-${item.id}.svg`;
};

const WorkCard: React.FC<{ item: ArchiveItem; onOpen: () => void }> = ({ item, onOpen }) => {
  const [imgOk, setImgOk] = useState(true);
  return (
    <button
      onClick={onOpen}
      className="group relative block overflow-hidden rounded-2xl border-2 border-line-warm bg-card text-left shadow-soft transition duration-300 hover:-translate-y-2 hover:border-ember/70 hover:shadow-lift"
    >
      {imgOk ? (
        <img
          src={workCover(item)}
          alt=""
          onError={() => setImgOk(false)}
          className="block h-auto max-h-[236px] w-auto max-w-[300px]"
        />
      ) : (
        <div className="flex h-[184px] w-[276px] items-center justify-center bg-paper text-ink-soft">
          <FolderOpen size={34} strokeWidth={1.5} />
        </div>
      )}
      {/* 底部渐隐压标题：卡牌化后标题直接躺在封面上 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent px-3 pb-2.5 pt-9">
        <span className="line-clamp-2 text-[12.5px] font-medium leading-snug text-paper">
          {item.title}
        </span>
        {item.borrowed && (
          <span className="mt-1 inline-block rounded bg-paper/25 px-1.5 py-0.5 text-[10px] text-paper/90">
            {home['borrowed-tag']}
          </span>
        )}
      </div>
    </button>
  );
};

/** 锁定作品的暗卡面（hover/聚焦浮出解锁预告） */
const LockedWorkFace: React.FC<{ c: (typeof WORK_CODEX)[number] }> = ({ c }) => {
  const Icon = c.icon;
  return (
    <div
      tabIndex={0}
      className="group relative flex h-[184px] w-[276px] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-cream/10 bg-dusk-2/80 outline-none"
    >
      <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-cream/8">
        <Icon size={22} strokeWidth={1.75} className="text-cream-soft/30" />
        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-dusk-2 ring-1 ring-cream/20">
          <Lock size={9} strokeWidth={2} className="text-cream-soft/70" />
        </span>
      </span>
      <span className="text-[12px] tracking-widest text-cream-soft/30">？？？</span>
      <span className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg bg-dusk/95 p-2 text-center text-[11px] leading-relaxed text-cream opacity-0 transition duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
        {interpolate(home['prompt-locked-hint'], {
          sem: codexSemName(c.sem),
          level: codexLevelLabel(c.sem, c.level),
        })}
      </span>
    </div>
  );
};

/** 作品牌堆（v3.6）：叠在一起的卡牌，左右按钮翻牌——当前牌居前，
 * 后面几张露边错角垫底；同一组元素换 transform 过渡，翻牌自带动画。 */
const WorkCodex: React.FC<{ works: ArchiveItem[]; onOpen: (item: ArchiveItem) => void }> = ({
  works,
  onOpen,
}) => {
  const [idx, setIdx] = useState(0);
  const byId = new Map(works.map((w) => [w.id, w]));
  const extras = works.filter((w) => !WORK_CODEX.some((c) => c.id === w.id));
  const deck: { key: string; node: React.ReactNode }[] = [
    ...WORK_CODEX.map((c) => {
      const item = byId.get(c.id);
      return {
        key: c.id,
        node: item ? (
          <WorkCard item={item} onOpen={() => onOpen(item)} />
        ) : (
          <LockedWorkFace c={c} />
        ),
      };
    }),
    ...extras.map((item) => ({
      key: item.id,
      node: <WorkCard item={item} onOpen={() => onOpen(item)} />,
    })),
  ];
  const n = deck.length;
  const cur = ((idx % n) + n) % n;
  // 牌堆姿态：rel=0 当前牌，1-3 依次垫底露边
  const POSE = [
    { rot: 0, x: 0, y: 0, s: 1, o: 1 },
    { rot: 5, x: 26, y: 8, s: 0.96, o: 0.85 },
    { rot: -4, x: -22, y: 12, s: 0.92, o: 0.6 },
    { rot: 8, x: 44, y: 18, s: 0.88, o: 0.35 },
  ];
  return (
    <div className="flex flex-col items-center gap-2.5 py-1">
    <div className="flex items-center justify-center gap-5">
      <button
        onClick={() => setIdx((v) => v - 1)}
        aria-label={home['deck-prev']}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream/20 bg-dusk/70 text-cream shadow-glass backdrop-blur-md transition hover:-translate-x-0.5 hover:border-ember/60 hover:text-ember"
      >
        <ChevronLeft size={18} strokeWidth={2} />
      </button>

      <div className="relative h-[270px] w-[390px]">
        {deck.map(({ key, node }, i) => {
          const rel = (i - cur + n) % n;
          if (rel > 3) return null;
          const p = POSE[rel];
          return (
            <div
              key={key}
              className="absolute left-1/2 top-1/2 w-max transition-all duration-300"
              style={{
                transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px) rotate(${p.rot}deg) scale(${p.s})`,
                zIndex: 40 - rel,
                opacity: p.o,
                pointerEvents: rel === 0 ? 'auto' : 'none',
              }}
            >
              {node}
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setIdx((v) => v + 1)}
        aria-label={home['deck-next']}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream/20 bg-dusk/70 text-cream shadow-glass backdrop-blur-md transition hover:translate-x-0.5 hover:border-ember/60 hover:text-ember"
      >
        <ChevronRight size={18} strokeWidth={2} />
      </button>

    </div>
      {/* 位置点：第几张一目了然，不用数字 */}
      <div className="flex items-center gap-1.5">
        {deck.map((d, i) => (
          <button
            key={d.key}
            onClick={() => setIdx(i)}
            aria-label={`${i + 1}/${n}`}
            className={`h-1.5 rounded-full transition-all ${
              i === cur ? 'w-4 bg-ember' : 'w-1.5 bg-cream/25 hover:bg-cream/50'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

/** 提示词卡的专属图标：图形替文字，卡面不再重复"点击查看/可复制"一类说明 */
const PROMPT_ICONS: Record<string, LucideIcon> = {
  'prompt-doc-feeding': FileText,
  'prompt-image-gen': ImageIcon,
  'prompt-structured-gen': Presentation,
  'prompt-ai-coding': CodeXml,
  'prompt-data-analysis': ChartColumn,
  'prompt-examiner': Mic,
  'prompt-lit-review': BookOpen,
  'prompt-multimodal': Clapperboard,
  'prompt-note-taking': NotebookPen,
  'prompt-resume': IdCard,
  'prompt-role-play': MessagesSquare,
  'prompt-thesis': GraduationCap,
};

/** 水彩三色签（v2.9）：按能力类别给图标底轮换低饱和色，像参考图里的彩色标签角 */
const WASH_TINTS: Record<string, { bg: string; fg: string }> = {
  sage: { bg: 'bg-wash-soft-sage', fg: 'text-wash-sage' },
  rose: { bg: 'bg-wash-soft-rose', fg: 'text-wash-rose' },
  ochre: { bg: 'bg-wash-soft-ochre', fg: 'text-wash-ochre' },
};
const PROMPT_WASH: Record<string, keyof typeof WASH_TINTS> = {
  'prompt-doc-feeding': 'sage',
  'prompt-lit-review': 'sage',
  'prompt-note-taking': 'sage',
  'prompt-data-analysis': 'sage',
  'prompt-thesis': 'sage',
  'prompt-image-gen': 'rose',
  'prompt-structured-gen': 'rose',
  'prompt-multimodal': 'rose',
  'prompt-ai-coding': 'rose',
  'prompt-examiner': 'ochre',
  'prompt-role-play': 'ochre',
  'prompt-resume': 'ochre',
};

/** 提示词卡：图标为主的紧凑法宝卡。hover 浮起并露出"复制"角标（图形示意，不占常驻文字） */
const PromptCard: React.FC<{ item: ArchiveItem; onOpen: () => void }> = ({ item, onOpen }) => {
  const Icon = PROMPT_ICONS[item.id] ?? Zap;
  const tint = WASH_TINTS[PROMPT_WASH[item.id] ?? 'ochre'];
  return (
    <button
      onClick={onOpen}
      aria-label={`${item.title}｜${home['prompt-open-hint']}`}
      className="group relative flex w-full flex-col items-center gap-2 rounded-2xl border border-line bg-card px-2 py-3 text-ink shadow-soft transition hover:-translate-y-1 hover:border-accent/50 hover:shadow-lift"
    >
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint.bg} transition group-hover:shadow-glow`}
      >
        <Icon size={19} strokeWidth={1.75} className={tint.fg} />
      </span>
      <span className="w-full truncate text-center text-[12px] font-medium leading-snug">
        {item.title.replace(/[·・]?\s*提示词模板$/, '')}
      </span>
      <span
        aria-hidden
        className="absolute right-2 top-2 text-ink-soft/0 transition group-hover:text-ink-soft"
      >
        <Copy size={13} strokeWidth={1.75} />
      </span>
    </button>
  );
};

/** 档案卡的专属图标（图形辅助识别，替掉纯文字白卡） */
const DOC_ICONS: Record<string, LucideIcon> = {
  'major-card': Compass,
  'course-map': MapIcon,
  'coding-fix': Bug,
  'notes-doc': NotebookPen,
  'mentor-email': Mail,
  'exam-sheet': ClipboardCheck,
  'interview-review': MessagesSquare,
  'doc-ppt-tools': Presentation,
  'ielts-speaking': Mic,
  'contest-map-doc': MapIcon,
};

/** 提示词图鉴（v3.4 · 方案A+B+D+可解锁中间态）：12 个槽位从第一天起全部可见。
 * 三态：锁定（剪影 + hover 预告解锁点）→ 可解锁（关卡已产出，等玩家亲手点亮）→ 已入库。
 * 「认领」是纯演出层状态（不动 PlayerState 契约），存 localStorage；
 * 换设备丢失只会让卡退回「可解锁」，再点一次即可，无进度损失。 */
const CLAIM_KEY = 'unisim_prompt_claims_v1';
const PROMPT_CODEX: { id: string; level: string; sem: string }[] = [
  { id: 'prompt-doc-feeding', level: 'course-select', sem: 'y1s1' },
  { id: 'prompt-image-gen', level: 'poster', sem: 'y1s1' },
  { id: 'prompt-structured-gen', level: 'ppt', sem: 'y1s2' },
  { id: 'prompt-ai-coding', level: 'coding', sem: 'y1s2' },
  { id: 'prompt-lit-review', level: 'mentor', sem: 'y2s1' },
  { id: 'prompt-note-taking', level: 'notes', sem: 'y2s1' },
  { id: 'prompt-data-analysis', level: 'dachuang', sem: 'y2s2' },
  { id: 'prompt-multimodal', level: 'gig', sem: 'y2s2' },
  { id: 'prompt-resume', level: 'resume', sem: 'y3s1' },
  { id: 'prompt-examiner', level: 'examiner', sem: 'y3s1' },
  { id: 'prompt-role-play', level: 'interview', sem: 'y3s2' },
  { id: 'prompt-thesis', level: 'thesis', sem: 'y4' },
];
const CODEX_SEMS = ['y1s1', 'y1s2', 'y2s1', 'y2s2', 'y3s1', 'y3s2', 'y4'];
const codexSemName = (sem: string) =>
  home['timeline'].split('｜')[CODEX_SEMS.indexOf(sem) + 1] ?? sem;
const codexLevelLabel = (sem: string, level: string) =>
  getBoard(sem).mainline.find((m) => m.id === level)?.label ?? level;

function readClaims(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLAIM_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

const PromptCodex: React.FC<{
  prompts: ArchiveItem[];
  onOpen: (item: ArchiveItem) => void;
}> = ({ prompts, onOpen }) => {
  const [claims, setClaims] = useState<Record<string, number>>(readClaims);
  const [claiming, setClaiming] = useState<string | null>(null);
  const byId = new Map(prompts.map((p) => [p.id, p]));

  const claim = (item: ArchiveItem) => {
    if (claiming) return;
    setClaiming(item.id);
    // 先播点亮动画，再入库+弹详情——「亲手解锁」的那一下要看得见
    window.setTimeout(() => {
      const next = { ...readClaims(), [item.id]: Date.now() };
      localStorage.setItem(CLAIM_KEY, JSON.stringify(next));
      setClaims(next);
      setClaiming(null);
      onOpen(item);
    }, 620);
  };

  return (
    <div className="grid grid-cols-3 gap-2.5 md:grid-cols-6">
      {PROMPT_CODEX.map(({ id, level, sem }) => {
        const item = byId.get(id);
        const Icon = PROMPT_ICONS[id] ?? Zap;
        const tint = WASH_TINTS[PROMPT_WASH[id] ?? 'ochre'];
        // 锁定：剪影槽位 + hover 预告解锁点（图鉴的「还差这张」）
        if (!item) {
          return (
            <div
              key={id}
              tabIndex={0}
              className="group relative flex flex-col items-center gap-2 rounded-2xl border border-cream/10 bg-dusk-2/40 px-2 py-3 outline-none"
            >
              <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-cream/8">
                <Icon size={19} strokeWidth={1.75} className="text-cream-soft/30" />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-dusk-2 ring-1 ring-cream/20">
                  <Lock size={9} strokeWidth={2} className="text-cream-soft/70" />
                </span>
              </span>
              <span className="w-full truncate text-center text-[12px] text-cream-soft/30">
                ？？？
              </span>
              <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-44 -translate-x-1/2 rounded-xl border border-cream/15 bg-dusk/95 p-2.5 text-center text-[11.5px] leading-relaxed text-cream opacity-0 shadow-glass backdrop-blur-md transition duration-150 group-focus-within:opacity-100 group-hover:opacity-100">
                {interpolate(home['prompt-locked-hint'], {
                  sem: codexSemName(sem),
                  level: codexLevelLabel(sem, level),
                })}
              </span>
            </div>
          );
        }
        // 可解锁：关卡已产出但还没被亲手点亮——呼吸光候着这一下
        if (!claims[id]) {
          const isClaiming = claiming === id;
          return (
            <button
              key={id}
              onClick={() => claim(item)}
              className={`flex flex-col items-center gap-2 rounded-2xl border-2 px-2 py-3 text-ink transition ${
                isClaiming
                  ? 'animate-pop-in border-ember bg-card shadow-ember-glow'
                  : 'animate-ember-breathe border-ember/70 bg-card shadow-glow hover:-translate-y-1'
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tint.bg}`}>
                <Icon size={19} strokeWidth={1.75} className={tint.fg} />
              </span>
              <span className="flex w-full items-center justify-center gap-1 truncate text-center text-[12px] font-semibold text-ember-deep">
                <Sparkles size={11} strokeWidth={2} />
                {home['prompt-claim-hint']}
              </span>
            </button>
          );
        }
        // 已入库：常规卡 + 24 小时 NEW 角标
        const isNew = Date.now() - claims[id] < 86_400_000;
        return (
          <div key={id} className="relative">
            <PromptCard item={item} onOpen={() => onOpen(item)} />
            {isNew && (
              <span className="pointer-events-none absolute -right-1 -top-1 rounded-full bg-ember px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-dusk shadow-soft">
                {home['prompt-new-badge']}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

/** 档案卡：信纸折角 + 图标牌 + 学期章。标题一行，其余进详情 */
const DOC_WASH: Record<string, keyof typeof WASH_TINTS> = {
  'major-card': 'ochre',
  'course-map': 'sage',
  'coding-fix': 'rose',
  'notes-doc': 'sage',
  'mentor-email': 'ochre',
  'exam-sheet': 'rose',
  'interview-review': 'ochre',
  'doc-ppt-tools': 'rose',
  'ielts-speaking': 'ochre',
  'contest-map-doc': 'ochre',
};
const DocCard: React.FC<{ item: ArchiveItem; onOpen: () => void }> = ({ item, onOpen }) => {
  const Icon = DOC_ICONS[item.id] ?? ScrollText;
  const tint = WASH_TINTS[DOC_WASH[item.id] ?? 'sage'];
  return (
    <button
      onClick={onOpen}
      className="relative flex w-full items-center gap-2.5 overflow-hidden rounded-xl border border-line bg-card p-3 pr-6 text-left text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lift"
    >
      <span className="absolute right-0 top-0 h-0 w-0 border-l-[18px] border-t-[18px] border-l-transparent border-t-line" />
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tint.bg}`}>
        <Icon size={17} strokeWidth={1.75} className={tint.fg} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{item.title}</span>
    </button>
  );
};

/** 档案区：按学期分组的横向索引卡列——学期做成竖排纸签分隔，
 * 卡面只留图标+标题（学期信息由分隔签承担，文字减法） */
const DocShelf: React.FC<{ docs: ArchiveItem[]; onOpen: (item: ArchiveItem) => void }> = ({
  docs,
  onOpen,
}) => {
  const sems = [...CODEX_SEMS, ...docs.map((d) => d.semester)].filter(
    (s, i, a) => a.indexOf(s) === i,
  );
  const groups = sems
    .map((sem) => ({ sem, items: docs.filter((d) => d.semester === sem) }))
    .filter((g) => g.items.length > 0);
  return (
    <div className="flex items-stretch gap-2.5 overflow-x-auto pb-1">
      {groups.map((g) => (
        <React.Fragment key={g.sem}>
          <div className="flex w-8 shrink-0 items-center justify-center rounded-lg border border-cream/12 bg-dusk-2/60">
            <span
              className="font-display text-[11px] tracking-[0.2em] text-cream-soft"
              style={{ writingMode: 'vertical-rl' }}
            >
              {codexSemName(g.sem)}
            </span>
          </div>
          {g.items.map((item) => (
            <div key={item.id} className="w-[216px] shrink-0 self-center">
              <DocCard item={item} onOpen={() => onOpen(item)} />
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

/** 详情弹层：完整内容，不做删减 */
const ArchiveDetail: React.FC<{
  item: ArchiveItem;
  state: Readonly<PlayerState>;
  onClose: () => void;
}> = ({ item, state, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [openDoc, setOpenDoc] = useState<1 | 2 | null>(null);
  const section = getFolderSection(item.id);
  // 速结行动发放的条目 levelId 是 action:xxx，没有对应关卡文案——降级为空 copy，别让详情弹层白屏
  const levelCopy = useMemo<Record<string, string>>(() => {
    try {
      return getLevelContent(item.levelId).copy;
    } catch {
      return {};
    }
  }, [item.levelId]);

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
          <div className="rounded-xl border border-line bg-card p-4 text-ink">
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
          <div className="rounded-xl border border-accent/40 bg-card p-4 text-ink">
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
                className="flex w-[360px] max-w-full items-center gap-3 rounded-2xl rounded-tl-md border border-accent/40 bg-card p-3.5 text-left text-ink shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-xl">
                  <FileText size={18} strokeWidth={1.75} className="text-accent" />
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
        className="flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-paper text-ink shadow-pop animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 固定头部：标题 + 关闭（不随内容滚动） */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-paper/80 px-6 py-3.5">
          <h3 className="truncate text-[16px] font-semibold">
            {section === 'prompts' ? <Zap size={14} strokeWidth={1.75} className="shrink-0 text-accent" /> : <FolderOpen size={14} strokeWidth={1.75} className="shrink-0 text-accent" />} {item.title}
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
        total={WORK_CODEX.length}
      />
      {/* 卡牌图鉴：10 位竖卡微扇形横滑，未获得为暗卡剪影（空态不复存在） */}
      <WorkCodex works={works} onOpen={open} />

      {/* 提示词库：图鉴式 12 槽位（锁定/可解锁/已入库三态），空态不复存在 */}
      <div className="mt-6">
        <SectionHead
          title={home['folder-sec-prompts']}
          sub={home['folder-sec-prompts-sub']}
          count={prompts.length}
          total={PROMPT_CODEX.length}
        />
        <PromptCodex prompts={prompts} onOpen={setOpenItem} />
      </div>

      {/* 档案：瀑布流 */}
      {docs.length > 0 && (
        <div className="mt-6">
          <SectionHead
            title={home['folder-sec-docs']}
            sub={home['folder-sec-docs-sub']}
            count={docs.length}
          />
          {/* 学期纸签分组的横向索引卡列（数量会一直涨，横滑不顶出页面滚动条） */}
          <DocShelf docs={docs} onOpen={open} />
        </div>
      )}

      {openItem && (
        <ArchiveDetail item={openItem} state={state} onClose={() => setOpenItem(null)} />
      )}
      {openDocItem && DOC_ITEMS[openDocItem.id] && (
        <DocViewer
          title={
            getLevelContent(DOC_ITEMS[openDocItem.id].level ?? openDocItem.levelId).copy[
              DOC_ITEMS[openDocItem.id].titleKey
            ] ?? openDocItem.title
          }
          md={
            getLevelContent(DOC_ITEMS[openDocItem.id].level ?? openDocItem.levelId).copy[
              DOC_ITEMS[openDocItem.id].mdKey
            ] ?? ''
          }
          onClose={() => setOpenDocItem(null)}
        />
      )}
    </Panel>
  );
};


const StatsTab: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => (
  /* 角色面板（v3.0）：左立绘+词条，右五轴+能力树——单屏放下，不出滚动条 */
  <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
    <aside className="flex flex-col gap-4">
      <PortraitCard state={state} />
      <Panel title={home['stats-entries-title']}>
        <EntryChips state={state} />
      </Panel>
      <Panel title={home['stats-tags-title']}>
        <AwakeningTree state={state} />
      </Panel>
    </aside>
    <section className="flex flex-col gap-4">
      <Panel title={home['stats-title']}>
        <div className="flex flex-col gap-2">
          {VISIBLE_AXES.map((a) => (
            <AxisBar key={a} label={ui.axes[a]} value={state.axes[a]} />
          ))}
          <AxisBar label={ui.axes.energy} value={state.axes.energy} strong />
          <p className="text-xs text-cream-soft">{home['stats-energy-note']}</p>
        </div>
      </Panel>
      <Panel title={home['stats-abilities-title']} sub={home['stats-tree-sub']}>
        <AbilityTree abilities={state.abilities} />
      </Panel>
    </section>
  </div>
);

/** 能力树：游戏技能树式的分支节点图。根节点（学长系统）分出四条支线，
 * 节点沿支线按主线解锁顺序推进；SVG 连线随目标节点解锁点亮。
 * 节点只有图标+短名，学期与状态进 hover title——不堆常驻文字。 */
const TREE_W = 660;
const TREE_H = 326;
const TREE_ROOT = { x: 64, y: TREE_H / 2 - 4 };
const TREE_ROWS_Y = [42, 122, 202, 282];
const TREE_COLS_X = [232, 388, 544];
const TREE_BRANCHES: {
  key: string;
  nodes: { id: string; sem: string; icon: LucideIcon }[];
}[] = [
  {
    key: 'academic',
    nodes: [
      { id: 'doc-feeding', sem: 'y1s1', icon: FileText },
      { id: 'lit-review', sem: 'y2s1', icon: BookOpen },
      { id: 'data-analysis', sem: 'y2s2', icon: ChartColumn },
    ],
  },
  {
    key: 'create',
    nodes: [
      { id: 'image-gen', sem: 'y1s1', icon: ImageIcon },
      { id: 'structured-gen', sem: 'y1s2', icon: Presentation },
      { id: 'multimodal', sem: 'y2s2', icon: Clapperboard },
    ],
  },
  {
    key: 'express',
    nodes: [
      { id: 'examiner', sem: 'y3s1', icon: Mic },
      { id: 'role-play', sem: 'y3s2', icon: MessagesSquare },
    ],
  },
  {
    key: 'build',
    nodes: [
      { id: 'ai-coding', sem: 'y1s2', icon: CodeXml },
      { id: 'note-taking', sem: 'y2s1', icon: NotebookPen },
    ],
  },
];

const AbilityTree: React.FC<{ abilities: readonly string[] }> = ({ abilities }) => {
  const semNames = home['timeline'].split('｜');
  const semName = (sem: string) =>
    semNames[['y1s1', 'y1s2', 'y2s1', 'y2s2', 'y3s1', 'y3s2', 'y4'].indexOf(sem) + 1] ?? sem;
  const lit = (id: string) => abilities.includes(id);
  return (
    <div className="overflow-x-auto">
      <div className="relative mx-auto" style={{ width: TREE_W, height: TREE_H }}>
        {/* 连线层：进入某节点的边，随该节点解锁点亮 */}
        <svg
          aria-hidden
          className="absolute inset-0"
          width={TREE_W}
          height={TREE_H}
          viewBox={`0 0 ${TREE_W} ${TREE_H}`}
        >
          {TREE_BRANCHES.map((b, bi) => {
            const y = TREE_ROWS_Y[bi];
            const first = b.nodes[0];
            const stroke = (on: boolean) => ({
              stroke: on ? '#FFB35C' : '#F6E7CC',
              strokeOpacity: on ? 0.75 : 0.14,
              strokeWidth: 2,
              fill: 'none' as const,
            });
            return (
              <g key={b.key}>
                <path
                  d={`M ${TREE_ROOT.x + 34} ${TREE_ROOT.y} C ${TREE_ROOT.x + 96} ${TREE_ROOT.y}, ${
                    TREE_COLS_X[0] - 110
                  } ${y}, ${TREE_COLS_X[0] - 34} ${y}`}
                  {...stroke(lit(first.id))}
                />
                {b.nodes.slice(1).map((n, i) => (
                  <line
                    key={n.id}
                    x1={TREE_COLS_X[i] + 34}
                    y1={y}
                    x2={TREE_COLS_X[i + 1] - 34}
                    y2={y}
                    {...stroke(lit(n.id))}
                  />
                ))}
              </g>
            );
          })}
        </svg>

        {/* 根节点：学长系统，永远点亮 */}
        <div
          className="absolute flex flex-col items-center"
          style={{ left: TREE_ROOT.x - 32, top: TREE_ROOT.y - 32, width: 64 }}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-ember bg-ember/15 shadow-glow">
            <Sparkles size={24} strokeWidth={1.75} className="text-ember" />
          </span>
          <span className="mt-1.5 whitespace-nowrap text-[10.5px] tracking-widest text-cream">
            {home['tree-root']}
          </span>
        </div>

        {/* 支线标签 */}
        {TREE_BRANCHES.map((b, bi) => {
          const branchLit = b.nodes.some((n) => lit(n.id));
          return (
            <span
              key={b.key}
              className={`absolute whitespace-nowrap text-[10px] tracking-widest ${
                branchLit ? 'text-ember' : 'text-cream-soft/45'
              }`}
              style={{ left: 132, top: TREE_ROWS_Y[bi] - 26 }}
            >
              {home[`tree-branch-${b.key}`]}
            </span>
          );
        })}

        {/* 能力节点 */}
        {TREE_BRANCHES.map((b, bi) =>
          b.nodes.map((n, ni) => {
            const unlocked = lit(n.id);
            const name = (ui.abilities as Record<string, string>)[n.id] ?? n.id;
            const Icon = n.icon;
            const x = TREE_COLS_X[ni];
            const y = TREE_ROWS_Y[bi];
            return (
              <div
                key={n.id}
                title={`${name}｜${semName(n.sem)}${unlocked ? '' : `｜${home['stats-tree-locked']}`}`}
                className="absolute flex flex-col items-center"
                style={{ left: x - 34, top: y - 27, width: 68 }}
              >
                <span
                  className={`relative flex h-[54px] w-[54px] items-center justify-center rounded-2xl border-2 transition ${
                    unlocked
                      ? 'border-ember bg-ember/15 shadow-glow'
                      : 'border-cream/15 bg-dusk-2/60 opacity-70'
                  }`}
                >
                  <Icon
                    size={20}
                    strokeWidth={1.75}
                    className={unlocked ? 'text-ember' : 'text-cream-soft/60'}
                  />
                  {!unlocked && (
                    <span className="absolute -bottom-1.5 -right-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-dusk-2 ring-1 ring-cream/25">
                      <Lock size={10} strokeWidth={2} className="text-cream-soft" />
                    </span>
                  )}
                </span>
                <span
                  className={`mt-1 w-full truncate text-center text-[10.5px] leading-tight ${
                    unlocked ? 'text-cream' : 'text-cream-soft/60'
                  }`}
                >
                  {name.replace(/^AI\s*/, '')}
                </span>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
};

/** 每条日志属于哪个学期：按日志里的「X学期开始了」标记切桶推出来。
 * 原先这里显示的是玩家电脑的真实时间（游戏里是 2026 年 9 月，页面上却写着今天的日期），
 * 而且同一秒写入的多条完全无法区分——记录页的意义是"这四年我做了什么"，那就该用游戏内时间。 */
function logSemesters(state: Readonly<PlayerState>): string[] {
  const tmpl = (ui['log-tmpl'] as Record<string, string>)['semester-start'];
  const names = home['timeline'].split('｜');
  const marker = new Map(
    names.map((n) => [interpolate(tmpl, { semester: n }), n] as const),
  );
  let cur = names[0] ?? '';
  return state.log.map((e) => {
    const hit = e.type === 'semester' ? marker.get(e.text) : undefined;
    if (hit) cur = hit;
    return cur;
  });
}

const LogTab: React.FC<{ state: Readonly<PlayerState> }> = ({ state }) => (
  <Panel title={home['log-title']}>
    {state.log.length === 0 ? (
      <p className="text-sm text-cream-soft">{home['log-empty']}</p>
    ) : (
      <ol className="flex flex-col gap-0.5">
        {[...state.log]
          .map((entry, i) => ({ entry, sem: logSemesters(state)[i] }))
          .reverse()
          .map(({ entry, sem }, i) => (
          <li key={i} className="flex items-baseline gap-3 border-b border-cream/10 py-2.5 last:border-b-0">
            <span className="w-14 shrink-0 text-xs text-cream-soft" title={entry.ts}>
              {sem}
            </span>
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
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Tab | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  // 首次进入 Home 自动播放新手引导（可跳过；顶栏可重看）
  const [tourOpen, setTourOpen] = useState(
    () => state.semester === 'y1s1' && !localStorage.getItem(TOUR_KEY),
  );
  const major = getMajor(state.player.majorId);
  const board = getBoard(state.semester);
  const mainlineDone = isMainlineComplete(state);
  const mainlineLeft = board.mainline.filter((m) => !state.completedActions.includes(m.id)).length;
  const graduated = state.semester === 'grad-end';
  // 毕业卡默认展开一次，关掉后本次停留期间不再挡住 Home（床位热点可随时重看）
  const [gradCard, setGradCard] = useState(true);

  return (
    // h-dvh 锁定视口高：场景主页是"一屏"页面，自身永不滚动（面板浮层各自内滚），杜绝滚出底图的白边
    <div className="relative h-dvh overflow-hidden bg-dusk">
      <DormScene />

      {/* 顶栏 HUD 数值条：深棕玻璃 + 奶油字 + 琥珀数值（与傍晚底图同色系） */}
      <header
        className="relative z-50 border-b border-cream/10 bg-gradient-to-b from-dusk/90 to-dusk/70 text-cream backdrop-blur-md backdrop-saturate-125"
        data-tour="rail"
      >
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-3 py-2.5 md:gap-6 md:px-6">
          <div className="flex shrink-0 items-baseline gap-3 max-md:gap-2">
            <span className="font-display text-[17px] font-semibold tracking-[0.25em] text-cream max-md:text-[15px] max-md:tracking-[0.1em]">
              {ui['app-title']}
            </span>
            {/* grad-end 复用 y4 的行动板配置，但顶栏不能跟着写「大四 · 秋冬」——人已经毕业了 */}
            <span className="text-xs text-cream-soft">
              {state.semester === 'grad-end' ? home['grad-header'] : board.header}
            </span>
          </div>
          <HudStrip state={state} />
          <div className="flex shrink-0 items-center gap-3 text-xs">
            {state.semester === 'y1s1' && (
              <button
                className="rounded-full border border-cream/25 px-2 py-0.5 text-cream-soft transition hover:border-ember hover:text-ember"
                onClick={() => {
                  setPanel(null);
                  setTourOpen(true);
                }}
              >
                ？{(ui.tour as Record<string, string>)['replay']}
              </button>
            )}
            <span className="font-medium text-cream max-md:hidden">
              {interpolate(home['greeting'], {
                playerName: state.player.name,
                majorName: major.name,
              })}
            </span>
            {isCloudMode ? (
              <>
                <span className="text-cream-soft/70 max-md:hidden">{email}</span>
                <button
                  className="text-cream-soft underline underline-offset-4 hover:text-ember"
                  onClick={() => void signOut()}
                >
                  {(ui.auth as Record<string, string>)['logout']}
                </button>
              </>
            ) : (
              <span className="rounded bg-cream/10 px-2 py-0.5 text-cream-soft max-md:hidden">
                {(ui.auth as Record<string, string>)['local-mode-title']}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* 场景热点：主页全部入口都长在底图上（底图 + 按钮式主页） */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-200 ${
          panel || (graduated && gradCard) ? 'opacity-0' : 'opacity-100'
        }`}
        data-tour="nav"
      >
        {/* 坐标按实景底图 bg-dorm.jpg 校准：书架左上、窗中上（避开水塔剪影）、便签墙右侧、笔记本中下、床左下 */}
        <SceneChip
          x={64} y={28} icon={<MapIcon size={16} strokeWidth={1.75} />}
          label={home['map-open-btn']}
          badge={mainlineLeft}
          active={mainlineLeft > 0}
          tour="mainline"
          onClick={() => setMapOpen(true)}
        />
        <SceneChip
          x={52} y={72} icon={<NotebookPen size={16} strokeWidth={1.75} />}
          label={home['nav-semester']}
          badge={state.actionPoints}
          active={mainlineDone && state.actionPoints > 0 && !graduated}
          tour="electives"
          onClick={() => setPanel('semester')}
        />
        <SceneChip x={9} y={22} icon={<FolderOpen size={16} strokeWidth={1.75} />} label={home['nav-folder']} badge={state.archive.length} onClick={() => setPanel('folder')} />
        <SceneChip x={8} y={68} icon={<BarChart3 size={16} strokeWidth={1.75} />} label={home['nav-stats']} onClick={() => setPanel('stats')} />
        <SceneChip x={89} y={42} icon={<ScrollText size={16} strokeWidth={1.75} />} label={home['nav-log']} onClick={() => setPanel('log')} />
        <SceneChip
          x={11} y={87} icon={<BedDouble size={16} strokeWidth={1.75} />}
          label={graduated ? home['view-ending'] : home['settle-btn']}
          active={mainlineDone || graduated}
          disabled={!mainlineDone && !graduated}
          tour="settle"
          onClick={() => navigate('/settlement')}
        />
      </div>

      {/* 毕业态：场景中央的毕业卡。带遮罩（不隔离背景就没有层级，卡片右缘还会切掉半个热点），
          但**必须可关闭**——毕业后玩家还要回来翻文件夹/属性/记录，常驻遮罩会把整个 Home 锁死。
          关掉后用床位那个「查看毕业身份卡」热点随时再看。 */}
      {graduated && !panel && gradCard && (
        <div
          className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-ink/60 px-6 pb-16 pt-24 backdrop-blur-[4px]"
          onClick={() => setGradCard(false)}
        >
          <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <SemesterEnded />
            <button
              className="mx-auto mt-4 block rounded-full border border-cream/25 bg-dusk/80 px-4 py-1.5 text-sm text-cream shadow-glass backdrop-blur-md transition hover:border-ember/60 hover:text-ember"
              onClick={() => setGradCard(false)}
            >
              {home['panel-close']}
            </button>
          </div>
        </div>
      )}

      {/* 面板浮层：点热点弹出对应内容 */}
      {panel && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-ink/65 p-3 pt-16 backdrop-blur-[6px] md:p-6 md:pt-16"
          onClick={() => setPanel(null)}
        >
          {/* 本学期/文件夹/属性都是单屏面板：更宽画布 + 不留触发滚动的底部余量 */}
          <div
            className={`w-full ${
              panel === 'log' ? 'max-w-[860px] pb-10' : 'max-w-[1080px] pb-2'
            } pt-2`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex justify-end">
              <button
                className="rounded-full border border-cream/25 bg-dusk/80 px-4 py-1.5 text-sm text-cream shadow-glass backdrop-blur-md backdrop-saturate-125 transition hover:border-ember/60 hover:text-ember"
                onClick={() => setPanel(null)}
              >
                ✕ {home['panel-close']}
              </button>
            </div>
            <div className="animate-fade-up">
              {panel === 'semester' && <SemesterTab state={state} />}
              {panel === 'folder' && <FolderTab state={state} />}
              {panel === 'stats' && <StatsTab state={state} />}
              {panel === 'log' && <LogTab state={state} />}
            </div>
          </div>
        </div>
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

      <SimModals state={state} />

      {tourOpen && <HomeTour onClose={() => setTourOpen(false)} />}
    </div>
  );
};
