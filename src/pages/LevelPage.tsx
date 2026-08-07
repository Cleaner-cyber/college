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

/** 关卡全屏底：本关场景图模糊放大铺满（jpg 优先，svg 兜底），压一层暖夜色保内容可读 */
const LevelBackdrop: React.FC<{ preferred: string; fallback: string }> = ({ preferred, fallback }) => {
  const [src, setSrc] = useState(preferred);
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
      <img
        src={src}
        onError={() => src !== fallback && setSrc(fallback)}
        alt=""
        className="h-full w-full scale-110 object-cover blur-lg"
      />
      <div className="absolute inset-0 bg-dusk/50" />
    </div>
  );
};

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
  // 全屏场景 backdrop：取本关第一个 VN 场景图（jpg 优先），模糊+压暖夜色垫底——关卡不再是白纸上的小窗
  const sceneKey = Object.keys(content.copy).find((k) => k.startsWith('scene-'));
  const sceneRaw = (sceneKey && content.presetAssets?.[content.copy[sceneKey]]) || '/assets/bg-dorm.svg';
  const scenePreferred = sceneRaw.replace(/\.svg$/, '.jpg');

  return (
    <div className="relative min-h-dvh">
      <LevelBackdrop preferred={scenePreferred} fallback={sceneRaw} />
      <header className="sticky top-0 z-10 border-b border-cream/10 bg-dusk/80 text-cream backdrop-blur-md backdrop-saturate-125">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-3">
          <button
            className="text-sm text-cream-soft underline underline-offset-4 transition hover:text-ember"
            onClick={() => setLeaving(true)}
          >
            ← {copy['back']}
          </button>
          <span className="font-display text-[16px] font-medium tracking-[0.15em]">{content.title}</span>
          <span className="rounded bg-ember/20 px-2 py-0.5 text-xs text-ember">{entry.tag}</span>
        </div>
      </header>

      <div className="relative z-[1]">
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
      </div>

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
