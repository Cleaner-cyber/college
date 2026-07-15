/**
 * 面试关：角色扮演收官。面试官读的是玩家三年攒下的真实档案——
 * 有「借来的」条目会被当场追问（坦诚/硬撑给出不同后果）；全自己做的则有专属爽点分支。
 */
import React, { useMemo, useState } from 'react';
import type { LevelModule, LevelProps, LevelResult, PlayerState } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { ui, getMajor, interpolate, getFolderSection } from '@/engine/content';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { ChatScript, type ChatStep } from '@/components/chat/ChatScript';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';

/** 依据玩家真实档案组装面试脚本与动态文案 */
function buildInterview(state: Readonly<PlayerState>, copy: Record<string, string>) {
  const items = state.archive.filter((a) => getFolderSection(a.id) !== 'prompts');
  const works = items.filter((a) => getFolderSection(a.id) === 'works');
  const showcase =
    works.find((w) => !w.borrowed) ?? works[0] ?? items.find((a) => !a.borrowed) ?? items[0];
  const borrowedItem = items.find((a) => a.borrowed);
  const forkItem = state.archive.find((a) => a.id.startsWith('fork-'));
  const direction = forkItem
    ? (copy[`dir-${forkItem.id.replace('fork-', '')}`] ?? forkItem.title.split(' · ').pop() ?? '')
    : '';

  const vars = {
    playerName: state.player.name,
    majorName: getMajor(state.player.majorId).name,
    direction: direction || (copy['dir-fallback'] ?? ''),
    workCount: items.filter((a) => !a.borrowed).length,
    workTitle: showcase?.title ?? '',
    borrowedTitle: borrowedItem?.title ?? '',
  };

  const dynamic: Record<string, string> = {
    'a1-built': interpolate(copy['a1-built'], vars),
    'q2-built': interpolate(copy['q2-built'], vars),
    'a2-built': interpolate(copy['a2-built'], vars),
    'q3b-built': interpolate(copy['q3b-built'], vars),
  };

  const steps: ChatStep[] = [
    { type: 'npc', key: 'q1' },
    { type: 'chip', labelKey: 'chip-a1', promptKey: 'a1-built', check: 'ck-rehearse' },
    { type: 'npc', key: 'q2-built' },
    { type: 'chip', labelKey: 'chip-a2', promptKey: 'a2-built', check: 'ck-star' },
    ...(borrowedItem
      ? ([
          { type: 'npc', key: 'q3b-built' },
          {
            type: 'chips',
            titleKey: 'chips-title-q3',
            options: [
              { labelKey: 'chip-honest', msgKey: 'a-honest' },
              { labelKey: 'chip-bluff', msgKey: 'a-bluff' },
            ],
          },
          { type: 'npc', key: 'q3-react' },
          { type: 'senpai', key: 'senpai-note-borrowed' },
        ] as ChatStep[])
      : ([
          {
            type: 'chips',
            titleKey: 'chips-title-clean',
            options: [{ labelKey: 'chip-clean', msgKey: 'a-clean' }],
            check: 'ck-honest',
          },
          { type: 'npc', key: 'q3-react-clean' },
          { type: 'senpai', key: 'senpai-note-clean' },
        ] as ChatStep[])),
    { type: 'npc', key: 'q4' },
    { type: 'chip', labelKey: 'chip-a4', promptKey: 'a4', check: 'ck-ai' },
    { type: 'npc', key: 'q-closing' },
    { type: 'senpai', key: 'senpai-wrap' },
    { type: 'button', labelKey: 'btn-deliver' },
  ];

  return { steps, dynamic, borrowedItem };
}

const InterviewComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];
  const assets = content.presetAssets ?? {};
  const { steps, dynamic, borrowedItem } = useMemo(
    () => buildInterview(state, content.copy),
    [state, content.copy],
  );

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { expression: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['role-play'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'interview-review',
        levelId: 'interview',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: '',
        borrowed,
      },
      {
        id: 'prompt-role-play',
        levelId: 'interview',
        title: content.copy['prompt-item-title'],
        resumeLine: '',
        borrowed: false,
      },
    ],
  });

  // 有 borrowed 条目时，「坦诚」选项在 wrap 后打 ck-honest（chips 只有一个 check 位，
  // 这里用包装 copy 无法表达分支打钩，故通过拦截 setVar 实现：honest 选项带 setVar）
  const wrap = (api: FlowAPI): FlowAPI => ({
    ...api,
    copy: (key: string, fallback = '') => dynamic[key] ?? api.copy(key, fallback),
    setVar: (k, v) => {
      if (k === 'q3' && v === 'honest') api.check('ck-honest');
      api.setVar(k, v);
    },
  });

  // 给坦诚选项挂 setVar 以触发打钩
  const stepsWired = useMemo(() => {
    if (!borrowedItem) return steps;
    return steps.map((s) =>
      s.type === 'chips' && s.titleKey === 'chips-title-q3'
        ? {
            ...s,
            options: s.options.map((o) =>
              o.labelKey === 'chip-honest' ? { ...o, setVar: ['q3', 'honest'] as [string, string] } : o,
            ),
          }
        : s,
    );
  }, [steps, borrowedItem]);

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
            <ChatScript api={wrap(api)} steps={stepsWired} assets={assets} onDone={api.advance} />
          ),
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

export const InterviewLevel: LevelModule = { id: 'interview', Component: InterviewComponent };
