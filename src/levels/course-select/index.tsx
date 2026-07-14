/**
 * 选课关：教学「投喂长文档」。必修·免费。
 * S2 拖入 PDF 工作台 / S5 追问 / S6 交付避坑课表 为自定义屏。
 */
import React, { useState } from 'react';
import type { LevelModule, LevelProps } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { getMajor, ui } from '@/engine/content';
import { Button } from '@/components/ui/Button';
import { Typewriter } from '@/components/ui/Typewriter';

const FeedPdfBench: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [dropped, setDropped] = useState(false);

  return (
    <div className="flex flex-col items-center gap-6 pt-4">
      <p className="text-[17px]">{api.t(api.screen.text ?? '')}</p>
      {/* AI 对话框 */}
      <div
        className={`flex h-44 w-full items-center justify-center rounded-2xl border-2 border-dashed transition-colors ${
          dropped ? 'border-accent bg-accent-soft' : 'border-line bg-card'
        }`}
      >
        {dropped ? (
          <div className="text-center animate-fade-up">
            <div className="text-3xl">📄</div>
            <div className="mt-1 text-sm text-accent">{api.copy('s2-pdf-name')}</div>
          </div>
        ) : (
          <span className="text-sm text-ink-soft">{api.copy('s2-chat-placeholder')}</span>
        )}
      </div>
      {/* PDF 文件 */}
      {!dropped && (
        <div className="flex w-full items-center gap-3 rounded-xl border border-line bg-card p-3">
          <div className="text-2xl">📄</div>
          <div className="flex-1">
            <div className="text-sm font-medium">{api.copy('s2-pdf-name')}</div>
            <div className="text-xs text-ink-soft">{api.copy('s2-pdf-size')}</div>
          </div>
          <Button
            onClick={() => {
              setDropped(true);
              window.setTimeout(api.advance, 800);
            }}
          >
            {api.copy('s2-drop-btn')}
          </Button>
        </div>
      )}
      {!dropped && <p className="text-xs text-ink-soft">{api.copy('s2-hint')}</p>}
    </div>
  );
};

const FollowUp: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [answered, setAnswered] = useState<string[]>([]);

  return (
    <div>
      <p className="text-[17px]">{api.t(api.screen.text ?? '')}</p>
      <div className="mt-5 flex flex-col gap-4">
        {(api.screen.choices ?? []).map((c) => (
          <div key={c.id}>
            <Button
              variant="secondary"
              full
              disabled={answered.includes(c.id)}
              onClick={() => setAnswered((a) => [...a, c.id])}
            >
              {c.label}
            </Button>
            {answered.includes(c.id) && (
              <div className="mt-2 rounded-xl bg-card p-3 text-[14px] leading-relaxed text-ink animate-fade-up">
                {api.copy(`s5-answer-${c.id}`)}
              </div>
            )}
          </div>
        ))}
      </div>
      {answered.length > 0 && (
        <Button full className="mt-8 animate-fade-up" onClick={() => api.goto('S6')}>
          {api.copy('s5-done-btn')}
        </Button>
      )}
    </div>
  );
};

const DeliverCourseMap: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [typed, setTyped] = useState(false);
  return (
    <div>
      <div className="rounded-2xl border border-accent/40 bg-card p-4 shadow-sm">
        <div className="text-base font-semibold">{api.copy('s6-card-title')}</div>
        <ul className="mt-3 space-y-2 text-[14px] leading-relaxed">
          <li>✓ {api.copy('s6-card-line1')}</li>
          <li>✓ {api.copy('s6-card-line2')}</li>
          <li>✓ {api.copy('s6-card-line3')}</li>
        </ul>
      </div>
      <p className="mt-2 text-center text-xs text-ink-soft">{api.copy('s6-footer')}</p>
      <div className="mt-6">
        <Typewriter
          text={api.t(api.screen.text ?? '')}
          onDone={() => setTyped(true)}
          className="text-[17px]"
        />
      </div>
      {typed && (
        <Button full className="mt-8 animate-fade-up" onClick={api.advance}>
          {api.nextLabel}
        </Button>
      )}
    </div>
  );
};

const CourseSelectComponent: React.FC<LevelProps> = ({ state, content, onComplete }) => {
  return (
    <ScreenPlayer
      content={content}
      globalVars={{
        playerName: state.player.name,
        majorName: getMajor(state.player.majorId).name,
      }}
      defaultNextLabel={ui.common.continue}
      senpaiLabel={ui.board['senpai-prefix']}
      custom={{
        S2: (api) => <FeedPdfBench api={api} />,
        S5: (api) => <FollowUp api={api} />,
        S6: (api) => <DeliverCourseMap api={api} />,
      }}
      onFinish={() =>
        onComplete({
          deltas: {},
          abilityUnlocks: ['doc-feeding'],
          archiveItems: [
            {
              id: 'course-map',
              levelId: 'course-select',
              title: content.copy['archive-title'],
              resumeLine: '',
              borrowed: false,
            },
          ],
        })
      }
    />
  );
};

export const CourseSelectLevel: LevelModule = {
  id: 'course-select',
  Component: CourseSelectComponent,
};
