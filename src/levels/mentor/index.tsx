/**
 * 找导师关：教学「读文献三问 + 套磁分寸」。大二上主线必修 · 全预设演出。
 * 拖入论文 → 三问读懂核心 → 按分寸起草套磁邮件 → 检查发送 → 收到导师回信。
 */
import React, { useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer } from '@/engine/ScreenPlayer';
import { ui } from '@/engine/content';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { ChatScript, type ChatStep } from '@/components/chat/ChatScript';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';

const STEPS: ChatStep[] = [
  { type: 'file', id: 'paper', nameKey: 'file-paper-name', metaKey: 'file-paper-meta' },
  { type: 'senpai', key: 'senpai-tip-1' },
  { type: 'chip', labelKey: 'chip-3q', promptKey: 'q-3q', check: 'ck-paper' },
  { type: 'ai', key: 'a-3q', check: 'ck-3q' },
  { type: 'senpai', key: 'senpai-tip-2' },
  { type: 'chip', labelKey: 'chip-email', promptKey: 'q-email' },
  { type: 'ai', key: 'a-email', check: 'ck-email' },
  { type: 'senpai', key: 'senpai-tip-3' },
  { type: 'chip', labelKey: 'chip-send', promptKey: 'q-send', check: 'ck-reply' },
  { type: 'npc', key: 'npc-reply' },
  { type: 'senpai', key: 'senpai-wrap' },
  { type: 'button', labelKey: 'btn-deliver' },
];

const MentorComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { expression: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['lit-review'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'mentor-email',
        levelId: 'mentor',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
      },
      {
        id: 'prompt-lit-review',
        levelId: 'mentor',
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

export const MentorLevel: LevelModule = { id: 'mentor', Component: MentorComponent };
