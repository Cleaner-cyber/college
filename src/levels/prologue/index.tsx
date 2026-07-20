/**
 * 序章：通知书 → 姓名 → 选专业 → 立 flag → 绑定学长 → 专业卡片 → 文件夹引入。
 * 建档写入（姓名/专业/flag）经引擎 ProfileContext，关卡不触碰 store。
 */
import React, { useMemo, useState } from 'react';
import type { LevelModule, LevelProps, Major, Trait } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { searchMajors, getMajor, majors, traits as allTraits, interpolate, ui } from '@/engine/content';
import { useProfile } from '@/engine/profile';
import { Button } from '@/components/ui/Button';
import { Typewriter } from '@/components/ui/Typewriter';

const FLAG_KEYS = ['salaryBand', 'city', 'workStyle', 'offTime'] as const;
const TRAIT_SHOW = 8; // 每局随机亮出的特质数
const TRAIT_PICK = 2; // 可选数量

/** 入学特质抽卡：随机亮 8 张选 2（build 起点，docs/08 C1） */
const TraitDraw: React.FC<{ api: FlowAPI; onConfirm: (ids: string[]) => void }> = ({
  api,
  onConfirm,
}) => {
  const shown = useMemo<Trait[]>(
    () => [...allTraits].sort(() => Math.random() - 0.5).slice(0, TRAIT_SHOW),
    [],
  );
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
                {on && (
                  <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-white">
                    {api.copy('trait-picked-tag')}
                  </span>
                )}
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

const MajorSelect: React.FC<{ api: FlowAPI; onSelect: (m: Major) => void }> = ({
  api,
  onSelect,
}) => {
  const [query, setQuery] = useState('');
  const results = searchMajors(query);
  const fallback = majors.find((m) => m.id === 'generic')!;

  return (
    <div>
      <p className="text-[17px] leading-relaxed">{api.t(api.screen.text ?? '')}</p>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={api.copy('major-search-placeholder')}
        className="mt-5 w-full rounded-xl border border-line bg-card px-4 py-3 text-[16px] outline-none focus:border-accent"
      />
      <div className="mt-4 flex max-h-[45dvh] flex-col gap-2 overflow-y-auto">
        {results.slice(0, 12).map((m) => (
          <Button key={m.id} variant="secondary" full onClick={() => onSelect(m)}>
            {m.name}
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
    </div>
  );
};

const MajorCard: React.FC<{ api: FlowAPI; majorId: string }> = ({ api, majorId }) => {
  const major = getMajor(majorId);
  const [typed, setTyped] = useState(false);
  const row = (label: string, body: React.ReactNode) => (
    <div className="border-t border-line py-2.5 first:border-t-0">
      <div className="text-[11px] tracking-widest text-ink-soft">{label}</div>
      <div className="mt-1 text-[14px] leading-relaxed">{body}</div>
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
              <span className="text-[11px] text-accent">{ui['app-title']}</span>
            </div>
            {row(api.copy('card-core-courses'), major.card.coreCourses.join(' · '))}
            {row(api.copy('card-hardest'), major.card.hardestY1.join(' / '))}
            {row(api.copy('card-gpa-killer'), major.card.gpaKiller)}
            {row(api.copy('card-destinations'), major.card.destinations.join(' · '))}
            {row(
              api.copy('card-secret'),
              <span className="text-accent">{major.card.secret}</span>,
            )}
          </div>
          <p className="mt-3 text-center text-xs text-ink-soft">{api.copy('card-footer')}</p>
          <Button full className="mt-6" onClick={api.advance}>
            {api.nextLabel}
          </Button>
        </>
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
