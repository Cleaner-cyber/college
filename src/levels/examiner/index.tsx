/**
 * 雅思口语陪练关：教学「口语陪练」。大三上主线必修 · 全预设演出。
 * 设定考官角色 → Part 1-3 全真模拟（不打断不纠错）→ 切教练要结构化点评 → 30 天陪练计划。
 */
import React, { useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer } from '@/engine/ScreenPlayer';
import { ui } from '@/engine/content';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { ChatScript, type ChatStep } from '@/components/chat/ChatScript';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';

const STEPS: ChatStep[] = [
  { type: 'senpai', key: 'senpai-tip-1' },
  { type: 'chip', labelKey: 'chip-setup', promptKey: 'q-setup', check: 'ck-role' },
  { type: 'ai', key: 'a-setup' },
  { type: 'senpai', key: 'senpai-tip-2' },
  {
    type: 'chips',
    titleKey: 'part1-title',
    options: [
      { labelKey: 'part1-a-label', msgKey: 'part1-a-msg' },
      { labelKey: 'part1-b-label', msgKey: 'part1-b-msg' },
      { labelKey: 'part1-c-label', msgKey: 'part1-c-msg' },
    ],
    check: 'ck-part1',
  },
  { type: 'ai', key: 'a-part1' },
  { type: 'senpai', key: 'senpai-tip-3' },
  { type: 'chip', labelKey: 'chip-part2', promptKey: 'q-part2' },
  { type: 'ai', key: 'a-part3' },
  { type: 'chip', labelKey: 'chip-feedback', promptKey: 'q-feedback', check: 'ck-feedback' },
  { type: 'ai', key: 'a-feedback' },
  { type: 'senpai', key: 'senpai-tip-4' },
  { type: 'chip', labelKey: 'chip-plan', promptKey: 'q-plan', check: 'ck-plan' },
  { type: 'ai', key: 'a-plan' },
  { type: 'senpai', key: 'senpai-wrap' },
  { type: 'button', labelKey: 'btn-deliver' },
];

const ExaminerComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { expression: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['examiner'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'ielts-speaking',
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
