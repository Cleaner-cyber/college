import React, { useEffect, useRef, useState } from 'react';

interface TypewriterProps {
  text: string;
  enabled?: boolean;
  speed?: number; // ms / 字
  onDone?: () => void;
  className?: string;
}

/** 打字机效果；点击正文可跳过。text 中 \n 分段。 */
export const Typewriter: React.FC<TypewriterProps> = ({
  text,
  enabled = true,
  speed = 38,
  onDone,
  className = '',
}) => {
  const [count, setCount] = useState(enabled ? 0 : text.length);
  const doneRef = useRef(false);

  useEffect(() => {
    setCount(enabled ? 0 : text.length);
    doneRef.current = !enabled;
  }, [text, enabled]);

  useEffect(() => {
    if (count >= text.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
      return;
    }
    const t = window.setTimeout(() => setCount((c) => c + 1), speed);
    return () => window.clearTimeout(t);
  }, [count, text, speed, onDone]);

  const shown = text.slice(0, count);
  return (
    <div
      className={`whitespace-pre-wrap leading-relaxed ${className}`}
      onClick={() => setCount(text.length)}
    >
      {shown}
      {count < text.length && <span className="animate-pulse text-accent">▍</span>}
    </div>
  );
};
