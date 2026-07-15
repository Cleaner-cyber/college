/**
 * 大创中期关：教学「数据分析 + 幻觉识别」。大二下主线必修 · 全预设演出。
 * 投喂问卷数据 → AI 跑分析 → 要文献（AI 编了两篇）→ 追问核验抓幻觉 → 用核实文献重写。
 */
import React, { useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer } from '@/engine/ScreenPlayer';
import { ui } from '@/engine/content';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { ChatScript, type ChatStep } from '@/components/chat/ChatScript';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';

const STEPS: ChatStep[] = [
  { type: 'file', id: 'data', nameKey: 'file-data-name', metaKey: 'file-data-meta' },
  { type: 'chip', labelKey: 'chip-analyze', promptKey: 'q-analyze', check: 'ck-data' },
  { type: 'ai', key: 'a-analyze', img: 'dachuang-chart' },
  { type: 'senpai', key: 'senpai-tip-2' },
  { type: 'chip', labelKey: 'chip-cite', promptKey: 'q-cite', check: 'ck-cite' },
  { type: 'ai', key: 'a-cite' },
  { type: 'senpai', key: 'senpai-warn' },
  { type: 'chip', labelKey: 'chip-verify', promptKey: 'q-verify' },
  { type: 'ai', key: 'a-verify', check: 'ck-halluc' },
  { type: 'senpai', key: 'senpai-hammer' },
  { type: 'chip', labelKey: 'chip-rewrite', promptKey: 'q-rewrite', check: 'ck-verify' },
  { type: 'ai', key: 'a-rewrite' },
  { type: 'button', labelKey: 'btn-deliver' },
];

const DachuangComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { academic: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['data-analysis'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'dachuang-report',
        levelId: 'dachuang',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
        assetRef: 'dachuang-chart',
      },
      {
        id: 'prompt-data-analysis',
        levelId: 'dachuang',
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
              img={assets['dachuang-chart']}
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

export const DachuangLevel: LevelModule = { id: 'dachuang', Component: DachuangComponent };
