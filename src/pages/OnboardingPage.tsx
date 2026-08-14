/**
 * 序章页面（建档）：沉浸式，无顶栏。完成后进入 Home。
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEngine } from '@/engine/store';
import { levelRegistry } from '@/engine/registry';
import { getLevelContent } from '@/engine/content';
import { ProfileContext } from '@/engine/profile';
import { EnvelopeIntro } from './EnvelopeIntro';

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const state = useEngine((s) => s.state)!;
  const setProfile = useEngine((s) => s.setProfile);
  const applyLevelResult = useEngine((s) => s.applyLevelResult);
  const mod = levelRegistry['prologue'];
  const content = getLevelContent('prologue');
  // 开局仪式：全新档先滑动启封（撕开录取通知书信封），再进序章 VN
  const [opened, setOpened] = useState(() => Boolean(state.player.name));

  if (!opened) {
    return <EnvelopeIntro copy={content.copy} onOpen={() => setOpened(true)} />;
  }

  return (
    <ProfileContext.Provider
      value={{
        setName: (name) => setProfile({ name }),
        setMajor: (majorId) => setProfile({ majorId }),
        setFlag: (flag) => setProfile({ flag }),
        setTraits: (traits) => setProfile({ traits }),
        setPathGoal: (pathGoal) => setProfile({ pathGoal }),
      }}
    >
      <div className="flex min-h-dvh flex-col justify-center">
        <mod.Component
          state={state}
          content={content}
          onComplete={(result) => {
            applyLevelResult('prologue', result);
            navigate('/home');
          }}
          onEscape={(result) => {
            applyLevelResult('prologue', result);
            navigate('/home');
          }}
        />
      </div>
    </ProfileContext.Provider>
  );
};
