/**
 * 宿舍动态场景（v2.8）：照片是"电影布景"，动态由浏览器实时渲染——
 * 杯口水汽、窗外行人/骑车穿行、远楼窗灯慢闪、台灯光晕与屏幕微光呼吸、
 * 偶尔掠过晚霞的鸟群、鼠标视差景深。坐标按 bg-dorm.jpg 构图校准。
 * 底图仍走真图优先（bg-dorm.jpg → 占位 SVG 回退），换图只需同名替换。
 */
import React from 'react';
import './dorm-scene.css';

/** 简笔行人剪影（窗外远景，深色压暗+轻模糊后融入照片） */
const WalkerSvg: React.FC<{ size?: number }> = ({ size = 22 }) => (
  <svg width={size * 0.5} height={size} viewBox="0 0 12 24" fill="currentColor" aria-hidden>
    <circle cx="6" cy="3" r="2.4" />
    <path d="M4 6.5h4l1 7h-2l.6 9h-2l-.6-8-.6 8h-2l.6-9h-2z" />
  </svg>
);

/** 简笔骑车剪影 */
const RiderSvg: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size * 1.5} height={size} viewBox="0 0 36 24" fill="currentColor" aria-hidden>
    <circle cx="8" cy="18" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="28" cy="18" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8 18 L15 10 L24 10 L28 18 M15 10 L18 18 M20 4 a2.2 2.2 0 1 0 .1 0 M19 7 l-3 3 M21 7 l3 4" stroke="currentColor" strokeWidth="1.8" fill="none" />
  </svg>
);

/** 三点式鸟群 */
const BirdsSvg: React.FC = () => (
  <svg width="42" height="18" viewBox="0 0 42 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <path d="M2 8 q3 -4 6 0 q3 -4 6 0" />
    <path d="M20 4 q2.5 -3.5 5 0 q2.5 -3.5 5 0" />
    <path d="M30 12 q2 -3 4 0 q2 -3 4 0" />
  </svg>
);

export const DormScene: React.FC = () => {
  const [src, setSrc] = React.useState('/assets/bg-dorm.jpg');
  // 鼠标视差：布景层反向缓移（放大 1.04 保边），UI 层不动 → 景深感
  const layerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX / window.innerWidth - 0.5;
      const dy = e.clientY / window.innerHeight - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `scale(1.045) translate(${-dx * 10}px, ${-dy * 7}px)`;
      });
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        ref={layerRef}
        className="absolute inset-0 transition-transform duration-700 ease-out"
        style={{ transform: 'scale(1.045)' }}
      >
        <img
          src={src}
          onError={() => src !== '/assets/bg-dorm.svg' && setSrc('/assets/bg-dorm.svg')}
          alt=""
          className="h-full w-full object-cover"
        />

        {/* 窗内动态：裁剪在窗框区域内（行人/骑车/远楼窗灯/鸟群不越出窗） */}
        <div
          className="absolute overflow-hidden"
          style={{ left: '31%', top: '5%', width: '50%', height: '52%' }}
        >
          {/* 行人（两位，错峰对穿） */}
          <div className="dorm-walker" style={{ left: '2%', bottom: '9%' }}>
            <WalkerSvg size={20} />
          </div>
          <div className="dorm-walker" style={{ left: '-4%', bottom: '6%', animationDelay: '17s' }}>
            <WalkerSvg size={24} />
          </div>
          {/* 自行车（反向） */}
          <div className="dorm-rider" style={{ right: '-6%', bottom: '7%', animationDelay: '9s' }}>
            <RiderSvg size={20} />
          </div>
          {/* 远楼窗灯慢闪 */}
          <span className="dorm-winlight" style={{ left: '52%', top: '68%', animationDelay: '0s' }} />
          <span className="dorm-winlight" style={{ left: '78%', top: '62%', animationDelay: '1.8s', animationDuration: '6.4s' }} />
          <span className="dorm-winlight" style={{ left: '65%', top: '75%', animationDelay: '3.1s', animationDuration: '4.2s' }} />
          <span className="dorm-winlight" style={{ left: '31%', top: '71%', animationDelay: '2.2s', animationDuration: '7.2s' }} />
          {/* 鸟群掠过晚霞 */}
          <div className="dorm-birds" style={{ left: '4%', top: '18%' }}>
            <BirdsSvg />
          </div>
        </div>

        {/* 杯子水汽（马克杯口） */}
        <span className="dorm-steam" style={{ left: '66.8%', top: '64.5%' }} />
        <span className="dorm-steam" style={{ left: '67.8%', top: '65%', animationDelay: '1.3s' }} />
        <span className="dorm-steam" style={{ left: '66.2%', top: '65.3%', animationDelay: '2.4s' }} />

        {/* 台灯光晕 / 笔记本屏幕微光 */}
        <div className="dorm-lampglow" style={{ left: '18%', top: '42%', width: '13%', height: '18%' }} />
        <div className="dorm-screenglow" style={{ left: '45.5%', top: '58%', width: '13%', height: '14%', animationDelay: '2s' }} />
      </div>
      {/* 极轻压色，保 UI 可读 */}
      <div className="absolute inset-0 bg-ink/10" />
    </div>
  );
};
