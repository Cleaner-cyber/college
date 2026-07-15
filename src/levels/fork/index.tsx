/**
 * 分岔口：大三下必修速结。保研/考研/考公/就业/留学五选一——换皮不换骨。
 * 选择记入档案（面试关据此个性化提问）。
 */
import React, { useState } from 'react';
import type { LevelModule, LevelProps } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { ui } from '@/engine/content';
import { Button } from '@/components/ui/Button';
import { Typewriter } from '@/components/ui/Typewriter';
import { SenpaiAvatar } from '@/components/ui/SpeakerTag';

const ForkResponse: React.FC<{ api: FlowAPI; onDone: (direction: string) => void }> = ({
  api,
  onDone,
}) => {
  const [typed, setTyped] = useState(false);
  const direction = api.vars.direction || 'job';
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-accent/40 bg-card p-5 text-center shadow-sm">
        <div className="text-[11px] tracking-widest text-ink-soft">{api.copy('s4-card-title')}</div>
        <div className="mt-1.5 text-3xl font-semibold text-accent">
          {api.copy(`dir-${direction}`)}
        </div>
        <p className="mt-2 text-xs text-ink-soft">{api.copy('s4-footer')}</p>
      </div>
      <div className="flex items-start gap-2.5">
        <SenpaiAvatar size={32} />
        <div className="flex-1 rounded-2xl rounded-tl-md border border-line bg-card p-4">
          <Typewriter
            text={api.copy(`resp-${direction}`)}
            onDone={() => setTyped(true)}
            className="text-[15px]"
          />
        </div>
      </div>
      {typed && (
        <Button full className="animate-fade-up" onClick={() => onDone(direction)}>
          {api.copy('next-S4')}
        </Button>
      )}
    </div>
  );
};

const ForkComponent: React.FC<LevelProps> = ({ state, content, onComplete }) => {
  return (
    <ScreenPlayer
      content={content}
      globalVars={{ playerName: state.player.name }}
      defaultNextLabel={ui.common.continue}
      senpaiLabel={ui.board['senpai-prefix']}
      custom={{
        S4: (api) => (
          <ForkResponse
            api={api}
            onDone={(direction) =>
              onComplete({
                deltas: {},
                abilityUnlocks: [],
                archiveItems: [
                  {
                    id: `fork-${direction}`,
                    levelId: 'fork',
                    title: content.copy['archive-title-prefix'] + content.copy[`dir-${direction}`],
                    resumeLine: '',
                    borrowed: false,
                  },
                ],
              })
            }
          />
        ),
      }}
      onFinish={() =>
        onComplete({ deltas: {}, abilityUnlocks: [], archiveItems: [] })
      }
    />
  );
};

export const ForkLevel: LevelModule = { id: 'fork', Component: ForkComponent };
