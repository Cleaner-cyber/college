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
        // 暖纸卡片（v2.8）：关卡页深色实景底上的浅色内容卡——羊皮纸/奶白替代纯白
        parchment: '#F7EDD9',
        milk: '#FFFBF0',
        'line-warm': '#E7D8BC',
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
        // 场景 UI 字体：霞鹜文楷（打包进项目的暖手写衬线）→ 宋体系兜底
        display: [
          '"LXGW WenKai Lite"',
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
        // 校园地图全屏转场：轻推近 + 淡入（"出门"感）
        'map-in': {
          '0%': { opacity: '0', transform: 'scale(1.06)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // 当期建筑高亮光斑：灯光式明暗呼吸
        halo: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.95' },
        },
        // 引导箭头弹跳：朝建筑方向上下跳动
        'arrow-bob': {
          '0%, 100%': { transform: 'translate(-50%, 0)' },
          '50%': { transform: 'translate(-50%, -10px)' },
        },
        // 箭头光晕脉动（与弹跳叠加）
        'arrow-glow': {
          '0%, 100%': { filter: 'drop-shadow(0 3px 6px rgba(20,8,2,0.5)) drop-shadow(0 0 4px rgba(255,196,120,0.4))' },
          '50%': { filter: 'drop-shadow(0 3px 6px rgba(20,8,2,0.5)) drop-shadow(0 0 14px rgba(255,196,120,0.9))' },
        },
        // 建筑柔光高亮：慢速一亮一暗
        'hl-glow': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        // VN 立绘入场：淡入 + 从上方 20px 落定 + 由 0.95 放到 1（DDLC transforms.rpy 的实测值）
        'sprite-in': {
          '0%': { opacity: '0', transform: 'translateY(-20px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s ease-out both',
        'num-pop': 'num-pop 0.5s ease-out',
        'pop-in': 'pop-in 0.3s cubic-bezier(0.2, 0.9, 0.3, 1.2) both',
        breathe: 'breathe 2.2s ease-in-out infinite',
        'ember-breathe': 'ember-breathe 2.4s ease-in-out infinite',
        'map-in': 'map-in 0.5s ease-out both',
        halo: 'halo 2.6s ease-in-out infinite',
        'arrow-bob': 'arrow-bob 1.2s ease-in-out infinite',
        'arrow-glow': 'arrow-glow 1.2s ease-in-out infinite',
        'hl-glow': 'hl-glow 3.2s ease-in-out infinite',
        'sprite-in': 'sprite-in 0.25s ease-in both',
      },
    },
  },
  plugins: [],
};
