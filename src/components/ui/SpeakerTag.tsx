import React from 'react';

interface SpeakerProps {
  speaker: 'senpai' | 'npc' | 'system';
  npcName?: string;
  senpaiLabel: string;
}

/** 学长头像（手绘线稿，/assets/senpai.svg 可同名替换为真手绘图） */
export const SenpaiAvatar: React.FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => (
  <img
    src="/assets/senpai.svg"
    alt=""
    width={size}
    height={size}
    className={`shrink-0 rounded-full border border-line bg-accent-soft ${className}`}
  />
);

/** NPC 头像：首字圆徽 */
export const NpcAvatar: React.FC<{ name?: string; size?: number }> = ({ name = '', size = 40 }) => (
  <span
    style={{ width: size, height: size }}
    className="flex shrink-0 items-center justify-center rounded-full border border-line bg-line/60 text-[15px] font-semibold text-ink-soft"
  >
    {name.slice(0, 1)}
  </span>
);

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
