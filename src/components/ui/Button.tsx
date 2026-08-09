import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  full?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  full = false,
  className = '',
  ...rest
}) => {
  // 禁用态用实色而不是整体降透明度：深色实景底图上 opacity-40 会让按钮连同文字一起
  // 溶进背景（实测对比度 1.05:1），看起来不像"不能点"，像"渲染坏了"
  const base =
    'rounded-xl px-5 py-3 text-[15px] font-medium transition-all duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-ink-soft/70 disabled:text-paper/90 disabled:shadow-none disabled:active:scale-100 disabled:hover:translate-y-0 disabled:hover:shadow-none';
  const styles = {
    primary:
      'bg-dusk-2 text-cream shadow-soft hover:-translate-y-0.5 hover:bg-dusk-2/90 hover:shadow-lift',
    secondary:
      'bg-milk border border-line-warm text-ink shadow-soft hover:-translate-y-0.5 hover:border-ink/30 hover:shadow-lift',
    ghost: 'text-ink-soft underline underline-offset-4 hover:text-ink',
  }[variant];
  return (
    <button className={`${base} ${styles} ${full ? 'w-full' : ''} ${className}`} {...rest} />
  );
};
