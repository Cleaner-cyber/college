/**
 * 序章：通知书 → 姓名 → 选专业 → 立 flag → 绑定学长 → 专业卡片 → 文件夹引入。
 * 建档写入（姓名/专业/flag）经引擎 ProfileContext，关卡不触碰 store。
 */
import React, { useEffect, useMemo, useState } from 'react';
import type { LevelModule, LevelProps, Major, MajorDetail, Trait } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import {
  searchMajors,
  getMajor,
  majors,
  majorGroups,
  fetchMajorDetail,
  paths,
  traits as allTraits,
  interpolate,
  ui,
} from '@/engine/content';
import { loadMeta, unlockedLegacyTraits } from '@/engine/meta';
import { useProfile } from '@/engine/profile';
import { Button } from '@/components/ui/Button';
import { Typewriter } from '@/components/ui/Typewriter';

const FLAG_KEYS = ['salaryBand', 'city', 'workStyle', 'offTime'] as const;
const TRAIT_SHOW = 8; // 每局随机亮出的特质数
const TRAIT_PICK = 2; // 可选数量

/** 出路六选一（v2.6）：考研/保研/考公/就业/出国/创业 —— 毕业按四年行为算走通概率 */
const PathSelect: React.FC<{ api: FlowAPI; onConfirm: (id: string) => void }> = ({
  api,
  onConfirm,
}) => {
  const [picked, setPicked] = useState('');
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="whitespace-pre-wrap text-[16px] leading-relaxed">{api.t(api.screen.text ?? '')}</p>
        <h2 className="mt-4 text-xl font-semibold">{api.copy('path-title')}</h2>
        <p className="mt-1 text-[13px] text-ink-soft">{api.copy('path-sub')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {paths.map((p) => {
          const on = picked === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setPicked(p.id)}
              className={`rounded-xl border p-3.5 text-left transition ${
                on
                  ? 'border-accent bg-accent-soft shadow-glow'
                  : 'border-line bg-card shadow-soft hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lift'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold">
                  {p.icon} {p.name}
                </span>
                {on && (
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">
                    {api.copy('path-picked-tag')}
                  </span>
                )}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{p.desc}</p>
            </button>
          );
        })}
      </div>
      <Button
        full
        disabled={!picked}
        onClick={() => {
          onConfirm(picked);
          api.advance();
        }}
      >
        {api.copy('path-confirm')}
      </Button>
    </div>
  );
};

/** 入学特质抽卡：随机亮 8 张选 2（build 起点，docs/08 C1）；
 * 传承特质（上一局结局解锁，docs/08 P3）不占随机位、置顶常驻 */
const TraitDraw: React.FC<{ api: FlowAPI; onConfirm: (ids: string[]) => void }> = ({
  api,
  onConfirm,
}) => {
  const shown = useMemo<Trait[]>(() => {
    const legacyIds = unlockedLegacyTraits();
    const legacy = allTraits.filter((t) => legacyIds.includes(t.id));
    const base = allTraits.filter((t) => !t.legacy).sort(() => Math.random() - 0.5).slice(0, TRAIT_SHOW);
    return [...legacy, ...base];
  }, []);
  const meta = useMemo(loadMeta, []);
  const [picked, setPicked] = useState<string[]>([]);

  const toggle = (id: string) =>
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length < TRAIT_PICK ? [...p, id] : p,
    );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="whitespace-pre-wrap text-[16px] leading-relaxed">{api.t(api.screen.text ?? '')}</p>
        <h2 className="mt-4 text-xl font-semibold">{api.copy('trait-title')}</h2>
        <p className="mt-1 text-[13px] text-ink-soft">{api.copy('trait-sub')}</p>
      </div>
      {meta.runs > 0 && meta.lastEndingTitle && (
        <div className="rounded-xl border border-accent/30 bg-accent-soft/40 p-3.5">
          <p className="text-[13px] leading-relaxed">
            {interpolate(api.copy('legacy-letter'), { title: meta.lastEndingTitle })}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {shown.map((t) => {
          const on = picked.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className={`rounded-xl border p-3.5 text-left transition ${
                on
                  ? 'border-accent bg-accent-soft shadow-glow'
                  : 'border-line bg-card shadow-soft hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-lift'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-semibold">{t.name}</span>
                <span className="flex items-center gap-1">
                  {t.legacy && (
                    <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-medium text-accent">
                      {api.copy('legacy-tag')}
                    </span>
                  )}
                  {on && (
                    <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">
                      {api.copy('trait-picked-tag')}
                    </span>
                  )}
                </span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{t.desc}</p>
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm tabular-nums text-ink-soft">
          {interpolate(api.copy('trait-count'), { n: picked.length })}
        </span>
        <Button
          disabled={picked.length !== TRAIT_PICK}
          onClick={() => {
            onConfirm(picked);
            api.advance();
          }}
        >
          {api.copy('trait-confirm')}
        </Button>
      </div>
    </div>
  );
};

/** 专业选择（v2.5，知识库全量 700+）：搜索直达，或按 门类 → 专业类 → 专业 分级浏览 */
const MajorSelect: React.FC<{ api: FlowAPI; onSelect: (m: Major) => void }> = ({
  api,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState(majorGroups[0]?.name ?? '');
  const [klass, setKlass] = useState(majorGroups[0]?.klasses[0]?.name ?? '');
  const searching = query.trim().length > 0;
  const results = searching ? searchMajors(query) : [];
  const fallback = majors.find((m) => m.id === 'generic')!;
  const curGroup = majorGroups.find((g) => g.name === group);
  const curKlass = curGroup?.klasses.find((k) => k.name === klass) ?? curGroup?.klasses[0];

  const chip = (label: string, on: boolean, onClick: () => void) => (
    <button
      key={label}
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[12px] transition ${
        on
          ? 'border-accent bg-accent-soft font-medium text-accent'
          : 'border-line bg-card text-ink-soft hover:border-accent/50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <p className="text-[17px] leading-relaxed">{api.t(api.screen.text ?? '')}</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={api.copy('major-search-placeholder')}
        className="mt-5 w-full rounded-xl border border-line bg-card px-4 py-3 text-[16px] outline-none focus:border-accent"
      />
      {searching ? (
        <div className="mt-4 flex max-h-[45dvh] flex-col gap-2 overflow-y-auto">
          {results.slice(0, 12).map((m) => (
            <Button key={m.id} variant="secondary" full onClick={() => onSelect(m)}>
              <span className="flex w-full items-baseline justify-between">
                <span>{m.name}</span>
                <span className="text-[11px] text-ink-soft">
                  {m.group} · {m.klass}
                </span>
              </span>
            </Button>
          ))}
          {results.length === 0 && (
            <div className="rounded-xl border border-dashed border-line p-4 text-center">
              <p className="text-sm text-ink-soft">{api.copy('major-search-empty')}</p>
              <Button className="mt-3" variant="secondary" full onClick={() => onSelect(fallback)}>
                {api.copy('major-fallback-pick')}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <div className="text-[11px] tracking-widest text-ink-soft">{api.copy('major-group-title')}</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {majorGroups.map((g) =>
              chip(g.name, g.name === group, () => {
                setGroup(g.name);
                setKlass(g.klasses[0]?.name ?? '');
              }),
            )}
          </div>
          {curGroup && curGroup.klasses.length > 1 && (
            <>
              <div className="mt-3 text-[11px] tracking-widest text-ink-soft">
                {api.copy('major-klass-title')}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {curGroup.klasses.map((k) => chip(k.name, k.name === curKlass?.name, () => setKlass(k.name)))}
              </div>
            </>
          )}
          <div className="mt-3 grid max-h-[30dvh] grid-cols-2 gap-2 overflow-y-auto">
            {(curKlass?.majors ?? []).map((m) => (
              <Button key={m.id} variant="secondary" full onClick={() => onSelect(m)}>
                {m.name}
              </Button>
            ))}
          </div>
          <button
            onClick={() => onSelect(fallback)}
            className="mt-3 w-full text-center text-xs text-ink-soft underline-offset-2 hover:underline"
          >
            {api.copy('major-fallback-pick')}
          </button>
        </div>
      )}
    </div>
  );
};

/** 知识库正文段落渲染：### 子标题 / 普通段落（详细页用） */
const KbBody: React.FC<{ body: string }> = ({ body }) => (
  <div className="space-y-2.5">
    {body.split(/\n{2,}/).map((p, i) => {
      const line = p.trim();
      if (!line) return null;
      if (line.startsWith('### ')) {
        return (
          <h4 key={i} className="pt-2 text-[14px] font-semibold">
            {line.slice(4)}
          </h4>
        );
      }
      return (
        <p key={i} className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
          {line}
        </p>
      );
    })}
  </div>
);

/** 专业速览卡（v2.5）：内容取自知识库对应专业文档，可展开查看全文 */
const MajorCard: React.FC<{ api: FlowAPI; majorId: string }> = ({ api, majorId }) => {
  const major = getMajor(majorId);
  const [typed, setTyped] = useState(false);
  const [detail, setDetail] = useState<MajorDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showFull, setShowFull] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchMajorDetail(major.id).then((d) => {
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
    [api.copy('card-positioning'), card.positioning ?? card.intro],
    [api.copy('card-fit'), card.fit],
    [api.copy('card-unfit'), card.unfit],
    [api.copy('card-pit'), card.pit],
    [api.copy('card-paths'), card.paths],
  ];
  const row = (label: string, body: React.ReactNode) => (
    <div key={label} className="border-t border-line py-2.5 first:border-t-0">
      <div className="text-[11px] tracking-widest text-ink-soft">{label}</div>
      <div className="mt-1 text-[13px] leading-relaxed">{body}</div>
    </div>
  );

  return (
    <div>
      <Typewriter
        text={api.t(api.screen.text ?? '')}
        onDone={() => setTyped(true)}
        className="text-[17px]"
      />
      {typed && (
        <>
          <div className="mt-5 rounded-2xl border border-accent/40 bg-card p-4 shadow-soft animate-fade-up">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-lg font-semibold">{major.name}</span>
              <span className="text-[11px] text-ink-soft">
                {major.group && `${major.group} · ${major.klass}`}
              </span>
            </div>
            {!loaded && <p className="py-4 text-center text-sm text-ink-soft">{api.copy('card-loading')}</p>}
            {loaded && !detail && (
              <p className="py-3 text-[14px] leading-relaxed text-ink-soft">{api.copy('card-generic-note')}</p>
            )}
            {loaded && detail && (
              <>
                {rows.filter(([, v]) => v).map(([label, v]) => row(label, v))}
                {detail.sections.length > 0 && (
                  <Button
                    variant="secondary"
                    full
                    className="mt-3"
                    onClick={() => setShowFull(true)}
                  >
                    {api.copy('card-detail-btn')}
                  </Button>
                )}
              </>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-ink-soft">{api.copy('card-footer')}</p>
          <Button full className="mt-6" onClick={api.advance}>
            {api.nextLabel}
          </Button>
        </>
      )}
      {showFull && detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-6"
          onClick={() => setShowFull(false)}
        >
          <div
            className="flex max-h-[86dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-paper shadow-lift"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <div>
                <div className="text-[11px] tracking-widest text-ink-soft">{api.copy('card-detail-title')}</div>
                <div className="text-lg font-semibold">{detail.name}</div>
              </div>
              <Button variant="secondary" onClick={() => setShowFull(false)}>
                {api.copy('card-detail-close')}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {detail.card.intro && (
                <p className="mb-4 rounded-xl bg-accent-soft/40 p-3 text-[13px] leading-relaxed">
                  {detail.card.intro}
                </p>
              )}
              {detail.sections.map((s) => (
                <details key={s.title} className="border-b border-line/70 py-2.5 last:border-b-0" open={false}>
                  <summary className="cursor-pointer select-none text-[15px] font-medium marker:text-accent">
                    {s.title}
                  </summary>
                  <div className="pb-2 pt-2.5">
                    <KbBody body={s.body} />
                  </div>
                </details>
              ))}
              <p className="pt-3 text-center text-[11px] text-ink-soft">{api.copy('card-detail-source')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const PrologueComponent: React.FC<LevelProps> = ({ state, content, onComplete }) => {
  const profile = useProfile();

  return (
    <ScreenPlayer
      content={content}
      globalVars={{
        playerName: state.player.name,
        majorName: state.player.majorId ? getMajor(state.player.majorId).name : '',
      }}
      defaultNextLabel={ui.common.continue}
      senpaiLabel={ui.board['senpai-prefix']}
      onVarChange={(key, value) => {
        if (key === 'playerName') profile.setName(value);
        if ((FLAG_KEYS as readonly string[]).includes(key)) profile.setFlag({ [key]: value });
      }}
      custom={{
        S3: (api) => (
          <MajorSelect
            api={api}
            onSelect={(m) => {
              profile.setMajor(m.id);
              api.advance();
            }}
          />
        ),
        SP: (api) => <PathSelect api={api} onConfirm={(id) => profile.setPathGoal(id)} />,
        ST: (api) => <TraitDraw api={api} onConfirm={(ids) => profile.setTraits(ids)} />,
        S6: (api) => <MajorCard api={api} majorId={state.player.majorId} />,
      }}
      overlay={(api) =>
        api.screen.id.startsWith('S4') ? (
          <p className="pb-2 pt-6 text-center text-xs text-ink-soft">
            {api.copy('flag-footnote')}
          </p>
        ) : null
      }
      onFinish={() =>
        onComplete({
          deltas: {},
          abilityUnlocks: [],
          archiveItems: [
            {
              id: 'major-card',
              levelId: 'prologue',
              title: content.copy['archive-major-card-title'],
              resumeLine: '',
              borrowed: false,
              assetRef: 'major-card',
            },
          ],
        })
      }
    />
  );
};

export const PrologueLevel: LevelModule = { id: 'prologue', Component: PrologueComponent };
