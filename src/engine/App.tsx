/**
 * 引擎路由/状态机：序章 → 行动板 ⇄ 关卡 → 结算 → 结束（可复看结局卡 + 重开）。
 */
import React, { useState } from 'react';
import type { LevelResult } from '@/contracts';
import { useEngine, effectiveCost } from './store';
import { levelRegistry } from './registry';
import { getLevelContent, boards, ui } from './content';
import { ProfileContext } from './profile';
import { ActionBoard } from './ActionBoard';
import { Button } from '@/components/ui/Button';

/** 关卡宿主：查插件、注入内容、承接 onComplete/onEscape */
const LevelHost: React.FC<{ levelId: string; onDone: () => void }> = ({ levelId, onDone }) => {
  const state = useEngine((s) => s.state);
  const applyLevelResult = useEngine((s) => s.applyLevelResult);
  const mod = levelRegistry[levelId];
  const content = getLevelContent(levelId);

  const levelEntry = boards.y1s1.levels.find((lv) => lv.id === levelId);
  const cost = levelEntry
    ? effectiveCost(levelEntry.cost, levelEntry.costWithAbility, state.abilities)
    : 0;

  const finish = (result: LevelResult) => {
    applyLevelResult(levelId, cost, result);
    onDone();
  };

  return (
    <mod.Component state={state} content={content} onComplete={finish} onEscape={finish} />
  );
};

/** 结局复看模式：结算屏可重复进入，底部提供重开 */
const EndView: React.FC = () => {
  const state = useEngine((s) => s.state);
  const reset = useEngine((s) => s.reset);
  const [confirming, setConfirming] = useState(false);
  const mod = levelRegistry['settlement'];
  const content = getLevelContent('settlement');

  return (
    <div className="pb-20">
      <mod.Component
        state={state}
        content={content}
        onComplete={() => setConfirming(true)}
        onEscape={() => setConfirming(true)}
      />
      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 p-3 backdrop-blur">
        <div className="mx-auto max-w-app">
          <Button variant="ghost" full onClick={() => setConfirming(true)}>
            {ui.end.restart}
          </Button>
        </div>
      </div>
      {confirming && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-5">
          <div className="w-full max-w-app rounded-2xl bg-paper p-5 animate-fade-up">
            <p className="text-[16px] font-medium">{ui.end['restart-confirm']}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button full onClick={reset}>
                {ui.end['restart-yes']}
              </Button>
              <Button variant="secondary" full onClick={() => setConfirming(false)}>
                {ui.end['restart-no']}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  const state = useEngine((s) => s.state);
  const setProfile = useEngine((s) => s.setProfile);
  const [activeLevel, setActiveLevel] = useState<string | null>(null);

  if (state.semester === 'prologue') {
    return (
      <ProfileContext.Provider
        value={{
          setName: (name) => setProfile({ name }),
          setMajor: (majorId) => setProfile({ majorId }),
          setFlag: (flag) => setProfile({ flag }),
        }}
      >
        <LevelHost levelId="prologue" onDone={() => setActiveLevel(null)} />
      </ProfileContext.Provider>
    );
  }

  if (state.semester === 'y1s1-end') {
    return <EndView />;
  }

  // y1s1
  if (activeLevel) {
    return <LevelHost levelId={activeLevel} onDone={() => setActiveLevel(null)} />;
  }

  return (
    <ActionBoard
      state={state}
      onEnterLevel={setActiveLevel}
      onSettle={() => setActiveLevel('settlement')}
    />
  );
};
