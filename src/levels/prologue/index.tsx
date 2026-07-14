/**
 * 序章：通知书 → 姓名 → 选专业 → 立 flag → 绑定学长 → 专业卡片 → 文件夹引入。
 * 建档写入（姓名/专业/flag）经引擎 ProfileContext，关卡不触碰 store。
 */
import React, { useState } from 'react';
import type { LevelModule, LevelProps, Major } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { searchMajors, getMajor, majors, ui } from '@/engine/content';
import { useProfile } from '@/engine/profile';
import { Button } from '@/components/ui/Button';
import { Typewriter } from '@/components/ui/Typewriter';

const FLAG_KEYS = ['salaryBand', 'city', 'workStyle', 'offTime'] as const;

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
          <div className="mt-5 rounded-2xl border border-accent/40 bg-card p-4 shadow-sm animate-fade-up">
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
