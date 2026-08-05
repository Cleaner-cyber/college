/**
 * 宿舍动态场景（v2.8）：照片是"电影布景"，动态由浏览器实时渲染——
 * 杯口水汽、窗外行人/骑车穿行、远楼窗灯慢闪、台灯光晕与屏幕微光呼吸、
 * 偶尔掠过晚霞的鸟群、鼠标视差景深。坐标按 bg-dorm.jpg 构图校准。
 * 底图仍走真图优先（bg-dorm.jpg → 占位 SVG 回退），换图只需同名替换。
 */
import React from 'react';
import './dorm-scene.css';

/**
 * 窗外交通层：光点沿照片里真实的道路走线滑行（SVG animateMotion，viewBox 随窗框拉伸自动贴路）。
 * 俯瞰远景里可信的运动是"路上的灯"：车头灯（暖白）、尾灯（暗红）、极小的行人暗点沿步道缓行。
 * 路径坐标 = 窗框区域内 0-1000 归一化，按 bg-dorm.jpg 的马路/步道描线。
 */
const WindowTraffic: React.FC = () => {
  // 一次穿越的时段占整个周期的比例（其余时间路上没车 →「时不时」）
  const mover = (
    path: string,
    dur: number,
    begin: number,
    crossRatio: number,
    core: string,
    r: number,
    halo: string,
    haloR: number,
    peak: number,
  ) => (
    <g opacity="0">
      <circle r={haloR} fill={halo} opacity="0.5" />
      <circle r={r} fill={core} />
      <animateMotion
        dur={`${dur}s`}
        begin={`${begin}s`}
        repeatCount="indefinite"
        calcMode="linear"
        keyPoints={`0;1;1`}
        keyTimes={`0;${crossRatio};1`}
        path={path}
      />
      <animate
        attributeName="opacity"
        dur={`${dur}s`}
        begin={`${begin}s`}
        repeatCount="indefinite"
        values={`0;${peak};${peak};0;0`}
        keyTimes={`0;0.02;${crossRatio - 0.02};${crossRatio};1`}
      />
    </g>
  );
  // 主干道（窗底路灯一线，左→右微抬）/ 近侧车道（右→左）/ 公园步道（树间灯带）
  const ROAD_LTR = 'M 15 950 C 350 944, 650 938, 985 930';
  const ROAD_RTL = 'M 985 966 C 650 971, 350 975, 15 979';
  const WALKWAY = 'M 300 886 C 420 880, 540 876, 660 872';
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* 车头灯：暖白光点 + 光晕，两辆错峰 */}
      {mover(ROAD_LTR, 34, 0, 0.4, '#FFE7C0', 4, '#FFC98A', 9, 0.9)}
      {mover(ROAD_LTR, 47, 21, 0.26, '#FFEACB', 3.4, '#FFC98A', 7.5, 0.8)}
      {/* 尾灯：暗红，反向 */}
      {mover(ROAD_RTL, 41, 9, 0.34, '#FF7A5C', 3.2, '#B33A2A', 6.5, 0.65)}
      {/* 行人：步道上极小的暗点，缓慢挪动（远景比例） */}
      {mover(WALKWAY, 52, 5, 0.55, '#241610', 3, '#241610', 0, 0.55)}
      {mover(WALKWAY, 63, 33, 0.5, '#2B1B12', 2.6, '#2B1B12', 0, 0.5)}
    </svg>
  );
};

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
          {/* 窗外交通：车灯/行人暗点沿照片里的道路走线滑行（俯瞰远景比例） */}
          <WindowTraffic />
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
