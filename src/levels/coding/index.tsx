/**
 * 编程报错关：教学「AI 编程」。大一下主线必修 · 全预设演出。
 * 贴报错 → 追问原理 → 自己改到跑通 → 让 AI 出题自测。
 */
import React, { useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer } from '@/engine/ScreenPlayer';
import { ui } from '@/engine/content';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { ChatScript, type ChatStep } from '@/components/chat/ChatScript';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';

const STEPS: ChatStep[] = [
  { type: 'chip', labelKey: 'chip-diagnose', promptKey: 'q-diagnose', check: 'ck-paste' },
  { type: 'ai', key: 'a-diagnose' },
  { type: 'senpai', key: 'senpai-tip-2' },
  { type: 'chip', labelKey: 'chip-why', promptKey: 'q-why', check: 'ck-why' },
  { type: 'ai', key: 'a-why' },
  { type: 'senpai', key: 'senpai-tip-3' },
  { type: 'chip', labelKey: 'chip-fix', promptKey: 'q-fix', check: 'ck-fix' },
  { type: 'ai', key: 'a-fix' },
  { type: 'chip', labelKey: 'chip-quiz', promptKey: 'q-quiz', check: 'ck-quiz' },
  { type: 'ai', key: 'a-quiz' },
  {
    type: 'chips',
    titleKey: 'quiz-title',
    options: [
      { labelKey: 'quiz-a-label', msgKey: 'quiz-a-msg' },
      { labelKey: 'quiz-b-label', msgKey: 'quiz-b-msg' },
      { labelKey: 'quiz-c-label', msgKey: 'quiz-c-msg' },
    ],
  },
  { type: 'ai', key: 'a-quiz-review' },
  { type: 'senpai', key: 'senpai-wrap' },
  { type: 'button', labelKey: 'btn-deliver' },
];

const CodingComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { academic: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['ai-coding'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'coding-fix',
        levelId: 'coding',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
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
        globalVars={{ playerName: state.player.name }}
        defaultNextLabel={ui.common.continue}
        senpaiLabel={ui.board['senpai-prefix']}
        wideScreens={['S3']}
        onCheckChange={setChecked}
        custom={{
          S3: (api) => <ChatScript api={api} steps={STEPS} assets={assets} onDone={api.advance} />,
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
        overlay={(api) => <EscapeOverlay api={api} />}
        onFinish={(r) => onComplete(buildResult(false, r.checked.length))}
      />
    </>
  );
};

export const CodingLevel: LevelModule = { id: 'coding', Component: CodingComponent };
