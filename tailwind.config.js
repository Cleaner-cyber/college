/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F7F5F0',
        card: '#FFFFFF',
        ink: '#1C1B18',
        'ink-soft': '#6B675E',
        line: '#E4E0D6',
        accent: '#C05A32',
        'accent-deep': '#A84A27',
        'accent-soft': '#F3E4DC',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(28,27,24,0.04), 0 4px 16px rgba(28,27,24,0.05)',
        lift: '0 2px 6px rgba(28,27,24,0.06), 0 10px 28px rgba(28,27,24,0.10)',
        pop: '0 24px 60px rgba(28,27,24,0.20)',
        glow: '0 0 0 3px rgba(192,90,50,0.18)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          'sans-serif',
        ],
      },
      maxWidth: {
        app: '480px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'num-pop': {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1)' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.94) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        breathe: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(192,90,50,0.35)' },
          '50%': { boxShadow: '0 0 0 5px rgba(192,90,50,0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'num-pop': 'num-pop 0.5s ease-out',
        'pop-in': 'pop-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        breathe: 'breathe 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
