/**
 * 应用外壳：认证初始化 → 存档适配器注入 → 路由守卫。
 * 路由：/login /onboarding /home /level/:levelId /settlement
 */
import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/services/auth';
import {
  LocalSaveAdapter,
  SupabaseSaveAdapter,
  setSaveAdapter,
} from '@/services/saveAdapter';
import { SEMESTER_CHAIN, useEngine } from './store';
import { getBoard, semesterName, ui } from './content';
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

/** 开发调试用：跳到任意学期的任意主线关（正式版移除） */
const DevJumpButton: React.FC = () => {
  const state = useEngine((s) => s.state);
  const devJump = useEngine((s) => s.devJump);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const dev = ui.dev as Record<string, string>;
  // 序章未完成时没有可跳的学期进度，不显示
  if (!state || state.semester === 'prologue') return null;

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-3 left-[124px] z-[70] rounded-full border border-line bg-card/90 px-3 py-1.5 text-[11px] text-ink-soft opacity-50 shadow-soft backdrop-blur transition hover:opacity-100"
      >
        ⇥ {dev['jump']} · {dev['jump-tag']}
      </button>
      {open && (
        <div className="fixed bottom-12 left-3 z-[70] max-h-[70dvh] w-72 overflow-y-auto rounded-2xl border border-line bg-paper p-4 shadow-pop animate-pop-in">
          <div className="mb-1 flex items-center justify-between">
            <h4 className="text-[13px] font-semibold">{dev['jump-title']}</h4>
            <button
              className="text-[11px] text-ink-soft underline underline-offset-2"
              onClick={() => setOpen(false)}
            >
              {dev['jump-close']}
            </button>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-ink-soft">{dev['jump-note']}</p>
          <div className="flex flex-col gap-3">
            {SEMESTER_CHAIN.map((sem) => (
              <div key={sem}>
                <div className="mb-1 text-[11px] font-semibold tracking-widest text-ink-soft">
                  {semesterName(sem)}
                </div>
                <div className="flex flex-col gap-1">
                  {getBoard(sem).mainline.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        devJump(sem, m.id);
                        setOpen(false);
                        navigate('/home', { replace: true });
                      }}
                      className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-left text-[12px] transition hover:border-accent/50 hover:text-accent"
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
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
      <DevJumpButton />
    </div>
  );
};
