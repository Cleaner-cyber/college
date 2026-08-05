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
        // 傍晚实景底图上的场景 UI（v2.7）：深棕玻璃 + 奶油字 + 琥珀强调（取色自 bg-dorm/bg-campus 成图）
        dusk: '#26180F',
        'dusk-2': '#3A2415',
        cream: '#F6E7CC',
        'cream-soft': '#CBB394',
        ember: '#FFB35C',
        'ember-deep': '#E08A3C',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(28,27,24,0.04), 0 4px 16px rgba(28,27,24,0.05)',
        lift: '0 2px 6px rgba(28,27,24,0.06), 0 10px 28px rgba(28,27,24,0.10)',
        pop: '0 24px 60px rgba(28,27,24,0.20)',
        glow: '0 0 0 3px rgba(192,90,50,0.18)',
        glass: '0 4px 18px rgba(24,10,3,0.40), inset 0 1px 0 rgba(255,220,178,0.18)',
        'ember-glow': '0 0 0 2px rgba(255,179,92,0.5), 0 0 18px rgba(255,166,77,0.45), 0 4px 14px rgba(24,10,3,0.4)',
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
        // 场景 UI 标题衬线（档案/信纸气质，系统字体栈无外链）
        display: [
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"Songti SC"',
          'STSong',
          'SimSun',
          'serif',
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
        // 灯光式亮度呼吸（只动光晕不动尺寸——照片底图上禁止缩放弹跳）
        'ember-breathe': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255,166,77,0), 0 0 12px rgba(255,166,77,0.25)' },
          '50%': { boxShadow: '0 0 0 3px rgba(255,166,77,0.2), 0 0 24px rgba(255,166,77,0.5)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'num-pop': 'num-pop 0.5s ease-out',
        'pop-in': 'pop-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        breathe: 'breathe 2.2s ease-in-out infinite',
        'ember-breathe': 'ember-breathe 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
