/**
 * 期末周考官关：教学「考官模式」。大三上主线必修 · 全预设演出。
 * 喂讲义 → 让 AI 出卷 → 认真作答 → 拿薄弱点诊断 → 变式再测 → 考前一页纸。
 */
import React, { useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer } from '@/engine/ScreenPlayer';
import { ui } from '@/engine/content';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { ChatScript, type ChatStep } from '@/components/chat/ChatScript';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';

const STEPS: ChatStep[] = [
  { type: 'file', id: 'mat', nameKey: 'file-mat-name', metaKey: 'file-mat-meta' },
  { type: 'senpai', key: 'senpai-tip-1' },
  { type: 'chip', labelKey: 'chip-exam', promptKey: 'q-exam', check: 'ck-feed' },
  { type: 'ai', key: 'a-exam' },
  { type: 'senpai', key: 'senpai-tip-2' },
  {
    type: 'chips',
    titleKey: 'exam-title',
    options: [
      { labelKey: 'exam-a-label', msgKey: 'exam-a-msg' },
      { labelKey: 'exam-b-label', msgKey: 'exam-b-msg' },
      { labelKey: 'exam-c-label', msgKey: 'exam-c-msg' },
    ],
    check: 'ck-exam',
  },
  { type: 'ai', key: 'a-review', check: 'ck-diagnose' },
  { type: 'senpai', key: 'senpai-tip-3' },
  { type: 'chip', labelKey: 'chip-variant', promptKey: 'q-variant' },
  { type: 'ai', key: 'a-variant' },
  { type: 'chip', labelKey: 'chip-variant-answer', promptKey: 'q-variant-answer' },
  { type: 'ai', key: 'a-variant-review' },
  { type: 'chip', labelKey: 'chip-sheet', promptKey: 'q-sheet', check: 'ck-sheet' },
  { type: 'ai', key: 'a-sheet' },
  { type: 'senpai', key: 'senpai-wrap' },
  { type: 'button', labelKey: 'btn-deliver' },
];

const ExaminerComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { academic: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['examiner'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'exam-sheet',
        levelId: 'examiner',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
      },
      {
        id: 'prompt-examiner',
        levelId: 'examiner',
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

export const ExaminerLevel: LevelModule = { id: 'examiner', Component: ExaminerComponent };
