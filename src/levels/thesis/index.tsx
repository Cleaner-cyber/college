/**
 * 毕业论文关：教学「AI 使用的边界与学术诚信」。大四主线必修 · 全预设演出。
 * 直球问边界 → 投喂学校规范提炼红线清单 → 审稿人模式挑摘要漏洞 → 生成 AI 使用声明。
 * 不解锁新能力：最后一课教的是「知止」。
 */
import React, { useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer } from '@/engine/ScreenPlayer';
import { ui } from '@/engine/content';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { ChatScript, type ChatStep } from '@/components/chat/ChatScript';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';

const STEPS: ChatStep[] = [
  { type: 'chip', labelKey: 'chip-direct', promptKey: 'q-direct', check: 'ck-border' },
  { type: 'ai', key: 'a-direct' },
  { type: 'senpai', key: 'senpai-tip-1' },
  { type: 'file', id: 'rule', nameKey: 'file-rule-name', metaKey: 'file-rule-meta' },
  { type: 'chip', labelKey: 'chip-redline', promptKey: 'q-redline', check: 'ck-redline' },
  { type: 'ai', key: 'a-redline' },
  { type: 'senpai', key: 'senpai-tip-2' },
  { type: 'chip', labelKey: 'chip-review', promptKey: 'q-review', check: 'ck-review' },
  { type: 'ai', key: 'a-review' },
  { type: 'senpai', key: 'senpai-tip-3' },
  { type: 'chip', labelKey: 'chip-declare', promptKey: 'q-declare', check: 'ck-declare' },
  { type: 'ai', key: 'a-declare' },
  { type: 'senpai', key: 'senpai-wrap' },
  { type: 'button', labelKey: 'btn-deliver' },
];

const ThesisComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { academic: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: [],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'thesis-doc',
        levelId: 'thesis',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
        assetRef: 'thesis-doc',
      },
      {
        id: 'prompt-thesis',
        levelId: 'thesis',
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
              img={assets['thesis-doc']}
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

export const ThesisLevel: LevelModule = { id: 'thesis', Component: ThesisComponent };
