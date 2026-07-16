/**
 * 应用外壳：认证初始化 → 存档适配器注入 → 路由守卫。
 * 路由：/login /onboarding /home /level/:levelId /settlement
 */
import React, { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/services/auth';
import {
  LocalSaveAdapter,
  SupabaseSaveAdapter,
  setSaveAdapter,
} from '@/services/saveAdapter';
import { useEngine } from './store';
import { ui } from './content';
import { LoginPage } from '@/pages/LoginPage';
import { OnboardingPage } from '@/pages/OnboardingPage';
import { HomePage } from '@/pages/HomePage';
import { LevelPage } from '@/pages/LevelPage';
import { SettlementPage } from '@/pages/SettlementPage';

const Loading: React.FC = () => (
  <div className="flex min-h-dvh items-center justify-center text-sm text-ink-soft">
    {ui.common.loading}
  </div>
);

/** 开发调试用：固定左下角的一键重置（正式版移除） */
const DevResetButton: React.FC = () => {
  const reset = useEngine((s) => s.reset);
  const navigate = useNavigate();
  const dev = ui.dev as Record<string, string>;
  return (
    <button
      onClick={() => {
        if (!window.confirm(dev['reset-confirm'])) return;
        try {
          localStorage.removeItem('unisim_tour_v1');
          localStorage.removeItem('unisim_vnhint_v1');
        } catch {
          /* ignore */
        }
        void reset().then(() => navigate('/onboarding', { replace: true }));
      }}
      className="fixed bottom-3 left-3 z-[70] rounded-full border border-line bg-card/90 px-3 py-1.5 text-[11px] text-ink-soft opacity-50 shadow-soft backdrop-blur transition hover:opacity-100"
    >
      ⟲ {dev['reset']} · {dev['reset-tag']}
    </button>
  );
};

/** 受保护区域：需要（云端模式下）已登录 + 存档已水合；序章未完成时强制进入序章 */
const Guard: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const status = useAuth((s) => s.status);
  const ready = useEngine((s) => s.ready);
  const state = useEngine((s) => s.state);
  const location = useLocation();

  if (status === 'loading') return <Loading />;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  if (!ready || !state) return <Loading />;

  const atOnboarding = location.pathname === '/onboarding';
  if (state.semester === 'prologue' && !atOnboarding) {
    return <Navigate to="/onboarding" replace />;
  }
  if (state.semester !== 'prologue' && atOnboarding) {
    return <Navigate to="/home" replace />;
  }
  return children;
};

export const App: React.FC = () => {
  const { status, userId, init } = useAuth();
  const hydrate = useEngine((s) => s.hydrate);
  const unload = useEngine((s) => s.unload);
  const location = useLocation();

  useEffect(() => {
    init();
  }, [init]);

  // 认证状态 → 存档适配器
  useEffect(() => {
    if (status === 'local') {
      setSaveAdapter(new LocalSaveAdapter());
      void hydrate();
    } else if (status === 'signed-in' && userId) {
      setSaveAdapter(new SupabaseSaveAdapter(userId));
      void hydrate();
    } else if (status === 'signed-out') {
      setSaveAdapter(null);
      unload();
    }
  }, [status, userId, hydrate, unload]);

  return (
    <div key={location.pathname} className="animate-fade-up">
      <Routes>
      <Route
        path="/onboarding"
        element={
          <Guard>
            <OnboardingPage />
          </Guard>
        }
      />
      <Route
        path="/home"
        element={
          <Guard>
            <HomePage />
          </Guard>
        }
      />
      <Route
        path="/level/:levelId"
        element={
          <Guard>
            <LevelPage />
          </Guard>
        }
      />
      <Route
        path="/settlement"
        element={
          <Guard>
            <SettlementPage />
          </Guard>
        }
      />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <DevResetButton />
    </div>
  );
};
