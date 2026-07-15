/**
 * 关卡页面：独立于 Home 的沉浸式页面。
 * 顶栏提供「返回主页」（中途离开不保存关卡内进度，行动不消耗）。
 */
import React, { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useEngine, isPlayingSemester } from '@/engine/store';
import { levelRegistry } from '@/engine/registry';
import { getLevelContent, getBoard, ui } from '@/engine/content';
import { Button } from '@/components/ui/Button';

const copy = ui['level-page'] as Record<string, string>;

export const LevelPage: React.FC = () => {
  const { levelId = '' } = useParams();
  const navigate = useNavigate();
  const state = useEngine((s) => s.state)!;
  const applyLevelResult = useEngine((s) => s.applyLevelResult);
  const [leaving, setLeaving] = useState(false);

  const entry = getBoard(state.semester).mainline.find((m) => m.id === levelId);
  const mod = levelRegistry[levelId];
  // 非法/已完成/学期不符 → 回主页
  if (!entry || !mod || !isPlayingSemester(state.semester) || state.completedActions.includes(levelId)) {
    return <Navigate to="/home" replace />;
  }
  const content = getLevelContent(levelId);

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3">
          <button
            className="text-sm text-ink-soft underline underline-offset-4"
            onClick={() => setLeaving(true)}
          >
            ← {copy['back']}
          </button>
          <span className="text-[15px] font-medium tracking-wide">{content.title}</span>
          <span className="rounded bg-accent-soft px-2 py-0.5 text-xs text-accent">{entry.tag}</span>
        </div>
      </header>

      <mod.Component
        state={state}
        content={content}
        onComplete={(result) => {
          applyLevelResult(levelId, result);
          navigate('/home');
        }}
        onEscape={(result) => {
          applyLevelResult(levelId, result);
          navigate('/home');
        }}
      />

      {leaving && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/30 p-6 backdrop-blur-[2px]">
          <div className="w-full max-w-sm rounded-2xl bg-paper p-6 shadow-pop animate-pop-in">
            <p className="text-[16px] font-medium">{copy['leave-confirm-title']}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button full onClick={() => navigate('/home')}>
                {copy['leave-yes']}
              </Button>
              <Button variant="secondary" full onClick={() => setLeaving(false)}>
                {copy['leave-no']}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
