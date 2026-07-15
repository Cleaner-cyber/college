/**
 * 专业课救命笔记关：教学「语音笔记」。大二上主线必修 · 全预设演出。
 * 喂录音 → 转结构化笔记 → 费曼式追问 → 生成自测卡。
 */
import React, { useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer } from '@/engine/ScreenPlayer';
import { ui } from '@/engine/content';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { ChatScript, type ChatStep } from '@/components/chat/ChatScript';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';

const STEPS: ChatStep[] = [
  { type: 'file', id: 'rec', nameKey: 'file-rec-name', metaKey: 'file-rec-meta' },
  { type: 'senpai', key: 'senpai-tip-1' },
  { type: 'chip', labelKey: 'chip-struct', promptKey: 'q-struct', check: 'ck-feed' },
  { type: 'ai', key: 'a-struct', check: 'ck-struct' },
  { type: 'senpai', key: 'senpai-tip-2' },
  { type: 'chip', labelKey: 'chip-feynman', promptKey: 'q-feynman', check: 'ck-feynman' },
  { type: 'ai', key: 'a-feynman' },
  { type: 'senpai', key: 'senpai-tip-3' },
  { type: 'chip', labelKey: 'chip-cards', promptKey: 'q-cards', check: 'ck-cards' },
  { type: 'ai', key: 'a-cards' },
  { type: 'senpai', key: 'senpai-wrap' },
  { type: 'button', labelKey: 'btn-deliver' },
];

const NotesComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { academic: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['note-taking'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'notes-doc',
        levelId: 'notes',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
        assetRef: 'notes-doc',
      },
      {
        id: 'prompt-note-taking',
        levelId: 'notes',
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
              img={assets['notes-doc']}
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

export const NotesLevel: LevelModule = { id: 'notes', Component: NotesComponent };
