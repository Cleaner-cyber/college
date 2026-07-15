/**
 * 暑假兼职关：教学「多模态一致性」。大二下主线（暑假）· 全预设演出。
 * 锁角色卡 → 带卡出三格分镜 → 只重画崩的那格 → 隐藏彩蛋：签约前把合同投喂给 AI（大一 doc-feeding 的回报时刻）。
 */
import React, { useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer } from '@/engine/ScreenPlayer';
import { ui } from '@/engine/content';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { ChatScript, type ChatStep } from '@/components/chat/ChatScript';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';

const STEPS: ChatStep[] = [
  { type: 'chip', labelKey: 'chip-char', promptKey: 'q-char', check: 'ck-char' },
  { type: 'ai', key: 'a-char' },
  { type: 'senpai', key: 'senpai-tip-1' },
  { type: 'chip', labelKey: 'chip-board', promptKey: 'q-board' },
  { type: 'ai', key: 'a-board', img: 'gig-board-v1', check: 'ck-board' },
  { type: 'npc', key: 'npc-reject' },
  { type: 'senpai', key: 'senpai-tip-2' },
  { type: 'chip', labelKey: 'chip-fix', promptKey: 'q-fix' },
  { type: 'ai', key: 'a-fix', img: 'gig-board-v2', check: 'ck-fix' },
  { type: 'npc', key: 'npc-contract' },
  { type: 'senpai', key: 'senpai-tip-3' },
  { type: 'file', id: 'contract', nameKey: 'file-contract-name', metaKey: 'file-contract-meta' },
  { type: 'chip', labelKey: 'chip-contract', promptKey: 'q-contract', check: 'ck-contract' },
  { type: 'ai', key: 'a-contract' },
  { type: 'npc', key: 'npc-agree' },
  { type: 'senpai', key: 'senpai-wrap' },
  { type: 'button', labelKey: 'btn-deliver' },
];

const GigComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => {
    const full = !borrowed && done === checklist.length;
    return {
      // 第一笔收入要重：满勾 +3，其余 +2
      deltas: { cash: full ? 3 : 2 },
      abilityUnlocks: ['multimodal'],
      checklistScore: { done, total: checklist.length },
      archiveItems: [
        {
          id: 'gig-board',
          levelId: 'gig',
          title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
          resumeLine: borrowed
            ? content.copy['archive-resume-line-borrowed']
            : content.copy['archive-resume-line'],
          borrowed,
          assetRef: 'gig-board-v2',
        },
        {
          id: 'prompt-multimodal',
          levelId: 'gig',
          title: content.copy['prompt-item-title'],
          resumeLine: '',
          borrowed: false,
        },
      ],
    };
  };

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
              img={assets['gig-board-v2']}
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

export const GigLevel: LevelModule = { id: 'gig', Component: GigComponent };
