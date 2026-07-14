import React from 'react';

interface SpeakerTagProps {
  speaker: 'senpai' | 'npc' | 'system';
  npcName?: string;
  senpaiLabel: string;
}

/** 对话屏的说话人标签。system 无标签，senpai 用强调色。 */
export const SpeakerTag: React.FC<SpeakerTagProps> = ({ speaker, npcName, senpaiLabel }) => {
  if (speaker === 'system') return null;
  const isSenpai = speaker === 'senpai';
  return (
    <span
      className={`mb-2 inline-block rounded-md px-2 py-0.5 text-xs font-semibold ${
        isSenpai ? 'bg-accent-soft text-accent' : 'bg-line text-ink-soft'
      }`}
    >
      {isSenpai ? senpaiLabel : (npcName ?? '')}
    </span>
  );
};
