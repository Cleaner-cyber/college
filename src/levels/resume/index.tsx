/**
 * 简历关：交付型。AI 用玩家的真实档案（resumeLine）自动填充简历初稿，
 * 再教 JD 对齐与 STAR 改写。动态内容通过包装 api.copy 注入 ChatScript。
 */
import React, { useMemo, useState } from 'react';
import type { LevelModule, LevelProps, LevelResult, PlayerState } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { ui, getMajor, interpolate, getFolderSection } from '@/engine/content';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { ChatScript, type ChatStep } from '@/components/chat/ChatScript';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';

const STEPS: ChatStep[] = [
  { type: 'chip', labelKey: 'chip-draft', promptKey: 'q-draft-built', check: 'ck-draft' },
  { type: 'ai', key: 'a-draft-built', check: 'ck-page' },
  { type: 'senpai', key: 'senpai-tip-2' },
  { type: 'chip', labelKey: 'chip-jd', promptKey: 'q-jd', check: 'ck-jd' },
  { type: 'ai', key: 'a-jd' },
  { type: 'senpai', key: 'senpai-tip-3' },
  { type: 'chip', labelKey: 'chip-star', promptKey: 'q-star', check: 'ck-star' },
  { type: 'ai', key: 'a-star' },
  { type: 'senpai', key: 'senpai-wrap' },
  { type: 'button', labelKey: 'btn-deliver' },
];

/** 从真实档案构造动态文案（清单 / 简历表格行） */
function buildDynamic(state: Readonly<PlayerState>, copy: Record<string, string>) {
  const items = state.archive.filter((a) => getFolderSection(a.id) !== 'prompts');
  const lines = items.map((a) => `- ${a.title}${a.resumeLine ? `：${a.resumeLine}` : ''}`);
  const rows = items
    .filter((a) => a.resumeLine)
    .map((a) => `| ${a.title} | ${a.resumeLine} |`)
    .join('\n');
  const abilities = state.abilities.map((a) => ui.abilities[a] ?? a).join('、');
  const vars = {
    playerName: state.player.name,
    majorName: getMajor(state.player.majorId).name,
    itemList: lines.join('\n'),
    rows,
    abilities,
    count: items.filter((a) => a.resumeLine).length,
  };
  return {
    'q-draft-built': interpolate(copy['q-draft-tmpl'], vars),
    'a-draft-built': interpolate(copy['a-draft-tmpl'], vars),
  };
}

const ResumeComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};
  const dynamic = useMemo(() => buildDynamic(state, content.copy), [state, content.copy]);

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { portfolio: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: [],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'resume-doc',
        levelId: 'resume',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: '',
        borrowed,
        assetRef: 'resume-doc',
      },
      {
        id: 'prompt-resume',
        levelId: 'resume',
        title: content.copy['prompt-item-title'],
        resumeLine: '',
        borrowed: false,
      },
    ],
  });

  // 包装 api：动态键（q-draft-built / a-draft-built）从真实档案生成
  const wrap = (api: FlowAPI): FlowAPI => ({
    ...api,
    copy: (key: string, fallback = '') => dynamic[key as keyof typeof dynamic] ?? api.copy(key, fallback),
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
          S3: (api) => (
            <ChatScript api={wrap(api)} steps={STEPS} assets={assets} onDone={api.advance} />
          ),
          S10: (api) => (
            <DeliverScreen
              api={api}
              total={checklist.length}
              img={assets['resume-doc']}
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

export const ResumeLevel: LevelModule = { id: 'resume', Component: ResumeComponent };
