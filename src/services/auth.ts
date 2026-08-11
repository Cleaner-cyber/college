/**
 * 认证 store（Zustand）。云端模式走 Supabase 邮箱+密码；
 * 未配置 Supabase 时 status = 'local'（本地试玩，无账号）。
 * error / notice 存的是 content/ui/ui.json 里 auth 段的文案键，由页面翻译。
 */
import { create } from 'zustand';
import { supabase, isCloudMode } from './supabase';
import { flushState } from './saveAdapter';

export type AuthStatus = 'loading' | 'signed-out' | 'signed-in' | 'local';

interface AuthStore {
  status: AuthStatus;
  userId: string | null;
  email: string | null;
  busy: boolean;
  errorKey: string | null;
  noticeKey: string | null;
  /** 用户点了重置邮件里的链接、带恢复会话回来：登录页据此弹「设置新密码」 */
  recovery: boolean;
  init: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  clearFeedback: () => void;
}

function mapError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'err-invalid';
  if (m.includes('already registered') || m.includes('already been registered')) return 'err-exists';
  if (m.includes('password should be at least') || m.includes('at least 6')) return 'err-weak-password';
  if (m.includes('email not confirmed')) return 'err-email-not-confirmed';
  return 'err-generic';
}

let initialized = false;

export const useAuth = create<AuthStore>((set) => ({
  status: 'loading',
  userId: null,
  email: null,
  busy: false,
  errorKey: null,
  noticeKey: null,
  recovery: false,

  init: () => {
    if (initialized) return;
    initialized = true;
    if (!isCloudMode || !supabase) {
      set({ status: 'local' });
      return;
    }
    supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        set({
          status: 'signed-in',
          userId: session.user.id,
          email: session.user.email ?? null,
          ...(event === 'PASSWORD_RECOVERY' ? { recovery: true } : {}),
        });
      } else {
        set({ status: 'signed-out', userId: null, email: null, recovery: false });
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) set({ status: 'signed-out' });
      // 有 session 时 onAuthStateChange 会推 signed-in
    });
  },

  signIn: async (email, password) => {
    if (!supabase) return;
    set({ busy: true, errorKey: null, noticeKey: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    set({ busy: false, errorKey: error ? mapError(error.message) : null });
  },

  signUp: async (email, password) => {
    if (!supabase) return;
    set({ busy: true, errorKey: null, noticeKey: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ busy: false, errorKey: mapError(error.message) });
      return;
    }
    // 项目开启了邮箱确认时：注册成功但无 session，提示去邮箱确认
    if (data.user && !data.session) {
      set({ busy: false, noticeKey: 'confirm-email-sent' });
    } else {
      set({ busy: false });
    }
  },

  signOut: async () => {
    if (!supabase) return;
    flushState(); // 防抖窗口里的最后一笔进度先落云，再断会话
    await supabase.auth.signOut();
  },

  resetPassword: async (email) => {
    if (!supabase) return;
    set({ busy: true, errorKey: null, noticeKey: null });
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    set({
      busy: false,
      errorKey: error ? mapError(error.message) : null,
      noticeKey: error ? null : 'reset-email-sent',
    });
  },

  updatePassword: async (password) => {
    if (!supabase) return;
    set({ busy: true, errorKey: null, noticeKey: null });
    const { error } = await supabase.auth.updateUser({ password });
    set({
      busy: false,
      errorKey: error ? mapError(error.message) : null,
      ...(error ? {} : { recovery: false, noticeKey: 'reset-done' }),
    });
  },

  clearFeedback: () => set({ errorKey: null, noticeKey: null }),
}));
