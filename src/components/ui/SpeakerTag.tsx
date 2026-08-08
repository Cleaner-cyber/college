import React, { useState } from 'react';

interface SpeakerProps {
  speaker: 'senpai' | 'npc' | 'system';
  npcName?: string;
  senpaiLabel: string;
}

/** 学长头像：真图 /assets/avatar-senpai.jpg 优先，缺省回退手绘线稿占位 senpai.svg */
export const SenpaiAvatar: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => {
  const [src, setSrc] = useState('/assets/avatar-senpai.jpg');
  return (
    <img
      src={src}
      onError={() => src !== '/assets/senpai.svg' && setSrc('/assets/senpai.svg')}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full border border-accent/30 bg-accent-soft object-cover shadow-soft ${className}`}
    />
  );
};

/** NPC 头像：传入 avatar 图（走 presetAssets）则显示真图，否则首字圆徽 */
export const NpcAvatar: React.FC<{ name?: string; size?: number; avatar?: string }> = ({
  name = '',
  size = 40,
  avatar,
}) => {
  const [failed, setFailed] = useState(false);
  if (avatar && !failed) {
    return (
      <img
        src={avatar}
        onError={() => setFailed(true)}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-line-warm bg-parchment object-cover shadow-soft"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full border border-line bg-line/60 text-[15px] font-semibold text-ink-soft"
    >
      {name.slice(0, 1)}
    </span>
  );
};

/** 对话说话人：头像 + 名字。system 无头像。 */
export const SpeakerTag: React.FC<SpeakerProps> = ({ speaker, npcName, senpaiLabel }) => {
  if (speaker === 'system') return null;
  const isSenpai = speaker === 'senpai';
  return (
    <div className="mb-2 flex items-center gap-2.5">
      {isSenpai ? <SenpaiAvatar /> : <NpcAvatar name={npcName} />}
      <span
        className={`text-sm font-semibold ${isSenpai ? 'text-accent' : 'text-ink-soft'}`}
      >
        {isSenpai ? senpaiLabel : (npcName ?? '')}
      </span>
    </div>
  );
};
