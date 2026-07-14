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
  const base =
    'rounded-xl px-5 py-3 text-[15px] font-medium transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100';
  const styles = {
    primary: 'bg-ink text-paper',
    secondary: 'bg-card border border-line text-ink',
    ghost: 'text-ink-soft underline underline-offset-4',
  }[variant];
  return (
    <button className={`${base} ${styles} ${full ? 'w-full' : ''} ${className}`} {...rest} />
  );
};
