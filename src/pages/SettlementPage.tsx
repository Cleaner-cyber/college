/**
 * 学期结算页：y1s1 主线完成后可进入；y1s1-end 可重复进入复看结局卡。
 */
import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useEngine, isMainlineComplete } from '@/engine/store';
import { levelRegistry } from '@/engine/registry';
import { getLevelContent } from '@/engine/content';

export const SettlementPage: React.FC = () => {
  const navigate = useNavigate();
  const state = useEngine((s) => s.state)!;
  const applyLevelResult = useEngine((s) => s.applyLevelResult);
  const mod = levelRegistry['settlement'];
  const content = getLevelContent('settlement');

  const canSettle = state.semester === 'y1s1' && isMainlineComplete(state);
  const isReview = state.semester === 'y1s1-end';
  if (!canSettle && !isReview) return <Navigate to="/home" replace />;

  return (
    <div className="mx-auto max-w-xl">
      <mod.Component
        state={state}
        content={content}
        onComplete={(result) => {
          if (!isReview) applyLevelResult('settlement', result);
          navigate('/home');
        }}
        onEscape={(result) => {
          if (!isReview) applyLevelResult('settlement', result);
          navigate('/home');
        }}
      />
    </div>
  );
};
