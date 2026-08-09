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
const BG_FALLBACK = '/assets/bg-gate.svg';

export const LoginPage: React.FC = () => {
  const { status, busy, errorKey, noticeKey, signIn, signUp, clearFeedback } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bgSrc, setBgSrc] = useState('/assets/bg-gate.jpg');

  if (status === 'signed-in') return <Navigate to="/home" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (mode === 'login') await signIn(email.trim(), password);
    else await signUp(email.trim(), password);
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-dusk px-6">
      {/* 校园底景：真图优先（与全站一致的 jpg→svg 回退），压一层暖夜色保证卡片可读 */}
      <img
        src={bgSrc}
        onError={() => bgSrc !== BG_FALLBACK && setBgSrc(BG_FALLBACK)}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dusk/65" />
      <div className="relative w-full max-w-sm pb-24">
        <header className="mb-8 text-center">
          <h1 className="font-display text-3xl font-bold tracking-widest text-cream">
            {copy['welcome-title']}
          </h1>
          <p className="mt-2 text-sm text-cream-soft">{copy['welcome-sub']}</p>
        </header>

        {!isCloudMode ? (
          <div className="rounded-2xl border border-cream/18 bg-dusk/85 p-6 text-center text-cream shadow-glass backdrop-blur-xl">
            <h2 className="font-display text-[15px] font-semibold text-cream">{copy['local-mode-title']}</h2>
            <p className="mt-2 text-sm leading-relaxed text-cream-soft">{copy['local-mode-desc']}</p>
            <Button full className="mt-5" onClick={() => navigate('/home')}>
              {copy['local-mode-btn']}
            </Button>
          </div>
        ) : (
          <form
            onSubmit={submit}
            className="rounded-2xl border border-cream/18 bg-dusk/85 p-6 text-cream shadow-glass backdrop-blur-xl"
          >
            <label className="block text-xs tracking-widest text-cream-soft">
              {copy['email-label']}
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={copy['email-placeholder']}
                className="mt-1.5 w-full rounded-xl border border-cream/20 bg-dusk-2/70 px-4 py-2.5 text-[15px] text-cream outline-none transition placeholder:text-cream-soft/50 focus:border-ember"
              />
            </label>
            <label className="mt-4 block text-xs tracking-widest text-cream-soft">
              {copy['password-label']}
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={copy['password-placeholder']}
                className="mt-1.5 w-full rounded-xl border border-cream/20 bg-dusk-2/70 px-4 py-2.5 text-[15px] text-cream outline-none transition placeholder:text-cream-soft/50 focus:border-ember"
              />
            </label>

            {errorKey && (
              <p className="mt-3 text-sm text-accent animate-fade-up">{copy[errorKey]}</p>
            )}
            {noticeKey && (
              <p className="mt-3 text-sm leading-relaxed text-cream animate-fade-up">
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
