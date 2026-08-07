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
    'rounded-xl px-5 py-3 text-[15px] font-medium transition-all duration-200 active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 disabled:hover:translate-y-0 disabled:hover:shadow-none';
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
