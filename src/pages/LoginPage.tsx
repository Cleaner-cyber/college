/**
 * 登录/注册页。云端模式：Supabase 邮箱+密码；
 * 本地模式（未配置 Supabase）：展示说明并直接进入本地试玩。
 */
import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/services/auth';
import { isCloudMode } from '@/services/supabase';
import { ui } from '@/engine/content';
import { Button } from '@/components/ui/Button';

const copy = ui.auth as Record<string, string>;

export const LoginPage: React.FC = () => {
  const { status, busy, errorKey, noticeKey, signIn, signUp, clearFeedback } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (status === 'signed-in') return <Navigate to="/home" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (mode === 'login') await signIn(email.trim(), password);
    else await signUp(email.trim(), password);
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      {/* 校园底景 */}
      <img
        src="/assets/bg-gate.svg"
        alt=""
        className="pointer-events-none absolute bottom-0 left-1/2 w-full min-w-[1100px] -translate-x-1/2 opacity-45"
      />
      <div className="relative w-full max-w-sm pb-24">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-widest">{copy['welcome-title']}</h1>
          <p className="mt-2 text-sm text-ink-soft">{copy['welcome-sub']}</p>
        </header>

        {!isCloudMode ? (
          <div className="rounded-2xl border border-line bg-card p-6 text-center">
            <h2 className="text-[15px] font-semibold">{copy['local-mode-title']}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{copy['local-mode-desc']}</p>
            <Button full className="mt-5" onClick={() => navigate('/home')}>
              {copy['local-mode-btn']}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-line bg-card p-6">
            <label className="block text-xs tracking-widest text-ink-soft">
              {copy['email-label']}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={copy['email-placeholder']}
                className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-[15px] text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="mt-4 block text-xs tracking-widest text-ink-soft">
              {copy['password-label']}
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={copy['password-placeholder']}
                className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-[15px] text-ink outline-none focus:border-accent"
              />
            </label>

            {errorKey && (
              <p className="mt-3 text-sm text-accent animate-fade-up">{copy[errorKey]}</p>
            )}
            {noticeKey && (
              <p className="mt-3 text-sm leading-relaxed text-ink animate-fade-up">
                {copy[noticeKey]}
              </p>
            )}

            <Button full type="submit" disabled={busy} className="mt-6">
              {busy ? copy['submitting'] : copy[mode === 'login' ? 'login-btn' : 'register-btn']}
            </Button>
            <button
              type="button"
              className="mt-4 w-full text-center text-sm text-ink-soft underline underline-offset-4"
              onClick={() => {
                setMode((m) => (m === 'login' ? 'register' : 'login'));
                clearFeedback();
              }}
            >
              {copy[mode === 'login' ? 'to-register' : 'to-login']}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
