/**
 * 语音模拟通话层：全屏通话界面（考官头像/计时/字幕/声波/麦克风作答）。
 * 考官语音优先播放预置音频 /assets/vo-ielts-{key}.mp3（铁律5：同名替换即可换真实录音），
 * 缺省回退浏览器本地朗读（speechSynthesis，非网络 AI 调用），再缺省按时长演出字幕。
 * 玩家作答为演出：选开口方式 → 按麦克风 → 波形动画 → 生成语音气泡（附转写文本）。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FlowAPI } from '@/engine/ScreenPlayer';
import { interpolate } from '@/engine/content';

type CallStage =
  | { k: 'vo'; key: string; cue?: boolean }
  | { k: 'answer'; options: { label: string; msg: string }[]; dur: string; check?: string }
  | { k: 'prep' }
  | { k: 'hangup' };

const STAGES: CallStage[] = [
  { k: 'vo', key: 'vo-greet' },
  {
    k: 'answer',
    options: [
      { label: 'part1-a-label', msg: 'part1-a-msg' },
      { label: 'part1-b-label', msg: 'part1-b-msg' },
      { label: 'part1-c-label', msg: 'part1-c-msg' },
    ],
    dur: 'dur-part1',
    check: 'ck-part1',
  },
  { k: 'vo', key: 'vo-part2', cue: true },
  { k: 'prep' },
  { k: 'answer', options: [{ label: 'chip-part2', msg: 'q-part2' }], dur: 'dur-part2' },
  { k: 'vo', key: 'vo-part3' },
  { k: 'answer', options: [{ label: 'chip-part3', msg: 'q-part3' }], dur: 'dur-part3' },
  { k: 'vo', key: 'vo-close' },
  { k: 'hangup' },
];

type Item =
  | { t: 'vo'; key: string; live: boolean }
  | { t: 'cue' }
  | { t: 'me'; msg: string; dur: string };

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** 挑一个英音优先的英语朗读音色 */
function pickVoice(): SpeechSynthesisVoice | null {
  const vs = window.speechSynthesis?.getVoices() ?? [];
  return (
    vs.find((v) => /^en[-_]GB/i.test(v.lang) && /female/i.test(v.name)) ??
    vs.find((v) => /^en[-_]GB/i.test(v.lang)) ??
    vs.find((v) => /Google/i.test(v.name) && /^en/i.test(v.lang)) ??
    vs.find((v) => /^en/i.test(v.lang)) ??
    null
  );
}

/** 声波动画（等高线条组） */
const Waveform: React.FC<{ active: boolean; bars?: number; className?: string }> = ({
  active,
  bars = 5,
  className = '',
}) => (
  <span className={`flex items-end gap-[3px] ${className}`}>
    {Array.from({ length: bars }, (_, i) => (
      <span
        key={i}
        className={`w-[3px] rounded-full bg-current ${active ? 'animate-pulse' : ''}`}
        style={{
          height: `${[8, 14, 20, 12, 16, 10, 18][i % 7]}px`,
          animationDelay: `${i * 0.13}s`,
          opacity: active ? undefined : 0.35,
        }}
      />
    ))}
  </span>
);

export const VoiceCall: React.FC<{ api: FlowAPI; onDone: (elapsed: string) => void }> = ({
  api,
  onDone,
}) => {
  const [idx, setIdx] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [subProgress, setSubProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [ended, setEnded] = useState(false);
  const [pendingMsg, setPendingMsg] = useState<string | null>(null); // 已选开口方式，待按麦克风
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const [prepLeft, setPrepLeft] = useState(60);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<(() => void) | null>(null);

  const stage = STAGES[idx] as CallStage | undefined;
  const speaking = stage?.k === 'vo';

  // 通话计时
  useEffect(() => {
    if (ended) return;
    const t = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [ended]);

  // 预热语音列表（Chrome 首次 getVoices 可能为空）
  useEffect(() => {
    window.speechSynthesis?.getVoices();
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items, subProgress, pendingMsg, recording, prepLeft]);

  // 考官发声阶段：预置音频 → 本地朗读 → 定时字幕，三级回退
  useEffect(() => {
    if (!stage || stage.k !== 'vo') return;
    let disposed = false;
    const text = api.copy(stage.key);
    setSubProgress(0);
    // 幂等插入（StrictMode 下 effect 会双跑）：同一段发言只入流一次
    setItems((arr) =>
      arr.some((it) => it.t === 'vo' && it.key === stage.key)
        ? arr
        : [
            ...arr,
            ...(stage.cue ? ([{ t: 'cue' }] as Item[]) : []),
            { t: 'vo', key: stage.key, live: true },
          ],
    );

    const timers: number[] = [];
    let audio: HTMLAudioElement | null = null;
    const finish = () => {
      if (disposed) return;
      disposed = true;
      setSubProgress(text.length);
      setItems((arr) => arr.map((it) => (it.t === 'vo' ? { ...it, live: false } : it)));
      setIdx((i) => i + 1);
    };
    // 字幕推进（音频/朗读模式下也跑，boundary 事件会覆盖校准）
    const est = Math.max(text.split(/\s+/).length * 360, 2600);
    timers.push(
      window.setInterval(() => {
        setSubProgress((p) => Math.min(text.length, p + Math.ceil(text.length / (est / 90))));
      }, 90) as unknown as number,
    );

    const startTts = () => {
      if (disposed) return;
      const synth = window.speechSynthesis;
      if (!synth) {
        timers.push(window.setTimeout(finish, est) as unknown as number);
        return;
      }
      // Chrome 兼容三板斧：①按句分段（整段长语句会静音超时）②周期 resume（cancel 后引擎
      // 偶发卡在 paused 静音）③等 voiceschanged（首次 getVoices 常为空数组）
      const chunks = text.match(/[^.!?]+[.!?]+['"”]?\s*/g) ?? [text];
      timers.push(window.setInterval(() => synth.resume(), 4000) as unknown as number);
      let offset = 0;
      const speakChunk = (i: number) => {
        if (disposed) return;
        if (i >= chunks.length) {
          finish();
          return;
        }
        const chunk = chunks[i];
        const u = new SpeechSynthesisUtterance(chunk);
        const v = pickVoice();
        if (v) u.voice = v;
        u.lang = v?.lang ?? 'en-GB';
        u.rate = 0.94;
        const base = offset;
        u.onboundary = (e) =>
          setSubProgress(Math.min(text.length, base + Math.max(e.charIndex, 0)));
        u.onend = () => {
          offset = base + chunk.length;
          speakChunk(i + 1);
        };
        u.onerror = () => {
          offset = base + chunk.length;
          speakChunk(i + 1);
        };
        synth.speak(u);
        synth.resume();
      };
      let begun = false;
      const begin = () => {
        if (begun || disposed) return;
        begun = true;
        timers.push(window.setTimeout(() => speakChunk(0), 80) as unknown as number);
      };
      synth.cancel();
      if (synth.getVoices().length > 0) {
        begin();
      } else {
        const onVoices = () => {
          synth.removeEventListener('voiceschanged', onVoices);
          begin();
        };
        synth.addEventListener('voiceschanged', onVoices);
        timers.push(
          window.setTimeout(() => {
            synth.removeEventListener('voiceschanged', onVoices);
            begin();
          }, 400) as unknown as number,
        );
      }
      // 看门狗：无声环境（无音色/无回调）按演出时长收尾
      timers.push(window.setTimeout(finish, Math.max(est * 2.2, 10000)) as unknown as number);
    };

    // 预置录音优先（/assets/vo-ielts-greet.mp3 等，文件不存在时落回朗读）
    audio = new Audio(`/assets/vo-ielts-${stage.key.replace(/^vo-/, '')}.mp3`);
    audio.onerror = startTts;
    audio.oncanplaythrough = () => {
      if (disposed || !audio) return;
      audio.onerror = null;
      audio.play().catch(startTts);
    };
    audio.onended = finish;

    skipRef.current = () => {
      window.speechSynthesis?.cancel();
      audio?.pause();
      finish();
    };
    return () => {
      disposed = true;
      timers.forEach((t) => {
        window.clearTimeout(t);
        window.clearInterval(t);
      });
      window.speechSynthesis?.cancel();
      if (audio) {
        audio.onerror = null;
        audio.oncanplaythrough = null;
        audio.pause();
      }
      skipRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Part 2 准备倒计时（演出加速）
  useEffect(() => {
    if (!stage || stage.k !== 'prep') return;
    setPrepLeft(60);
    const t = window.setInterval(() => {
      setPrepLeft((s) => {
        if (s <= 1) {
          window.clearInterval(t);
          setIdx((i) => i + 1);
          return 0;
        }
        return s - 1;
      });
    }, 45);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // 录音演出计秒
  useEffect(() => {
    if (!recording) return;
    setRecSec(0);
    const t = window.setInterval(() => setRecSec((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  const stopRec = () => {
    if (!stage || stage.k !== 'answer' || pendingMsg === null) return;
    setRecording(false);
    setItems((arr) => [...arr, { t: 'me', msg: pendingMsg, dur: api.copy(stage.dur) }]);
    setPendingMsg(null);
    setIdx((i) => i + 1);
  };

  const cueLines = useMemo(
    () => ['cue-l1', 'cue-l2', 'cue-l3', 'cue-l4'].map((k) => api.copy(k)).filter(Boolean),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const status =
    stage?.k === 'vo'
      ? api.copy('call-status-speaking')
      : stage?.k === 'answer'
        ? pendingMsg === null && stage.options.length > 1
          ? api.copy('call-status-yourturn')
          : api.copy('call-status-mic')
        : stage?.k === 'hangup'
          ? api.copy('call-hangup-hint')
          : '';

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-ink text-paper">
      {/* 顶栏：状态 + 计时 */}
      <header className="flex items-center gap-3 border-b border-paper/10 px-5 py-3">
        <span className={`h-2.5 w-2.5 rounded-full bg-emerald-400 ${ended ? '' : 'animate-pulse'}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium">{api.copy('call-title')}</div>
          <div className="text-[11px] text-paper/50">{api.copy('call-name')}</div>
        </div>
        <span className="text-[15px] tabular-nums text-paper/80">{fmt(elapsed)}</span>
      </header>

      {!ended ? (
        <>
          {/* 考官区：头像 + 呼吸环 */}
          <div className="flex flex-col items-center gap-2 pb-2 pt-6">
            <div className="relative flex h-20 w-20 items-center justify-center">
              {speaking && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
                  <span className="absolute -inset-2 rounded-full border border-accent/30 animate-pulse" />
                </>
              )}
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-paper/10 text-3xl">
                🎧
              </span>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-paper/60">
              {speaking && <Waveform active className="text-accent" />}
              {status}
              {speaking && <span className="text-paper/35">· {api.copy('call-sub-hint')}</span>}
            </div>
          </div>

          {/* 通话字幕/记录流 */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
            <div className="mx-auto flex max-w-2xl flex-col gap-3">
              {items.map((it, i) => {
                if (it.t === 'cue') {
                  return (
                    <div key={i} className="mx-auto w-full max-w-md rounded-2xl bg-paper p-4 text-ink shadow-pop animate-pop-in">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-semibold tracking-[0.2em] text-accent">
                          {api.copy('call-cue-tag')}
                        </span>
                        {STAGES[idx]?.k === 'prep' && (
                          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-[11px] tabular-nums text-accent">
                            {api.copy('call-prep-label')} {fmt(prepLeft)}
                          </span>
                        )}
                      </div>
                      <p className="text-[14.5px] font-semibold leading-snug">{api.copy('cue-title')}</p>
                      <ul className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-soft">
                        {cueLines.map((l, j) => (
                          <li key={j} className="flex gap-1.5">
                            <span className="text-accent">•</span>
                            {l}
                          </li>
                        ))}
                      </ul>
                      {STAGES[idx]?.k === 'prep' && (
                        <p className="mt-2 text-right text-[10.5px] text-ink-soft/70">{api.copy('call-accel')}</p>
                      )}
                    </div>
                  );
                }
                if (it.t === 'vo') {
                  const text = api.copy(it.key);
                  const shown = it.live ? Math.min(subProgress, text.length) : text.length;
                  return (
                    <div
                      key={i}
                      onClick={() => it.live && skipRef.current?.()}
                      className={`max-w-[88%] text-[14px] leading-relaxed ${it.live ? 'cursor-pointer text-paper' : 'text-paper/45'}`}
                    >
                      <span>{text.slice(0, shown)}</span>
                      <span className="text-paper/25">{text.slice(shown)}</span>
                    </div>
                  );
                }
                return (
                  <div key={i} className="flex justify-end animate-fade-up">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent/90 px-4 py-2.5 text-paper">
                      <div className="flex items-center gap-2">
                        <Waveform active={false} bars={12} />
                        <span className="text-[12px] tabular-nums">{it.dur}</span>
                      </div>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-paper/85">
                        {api.copy(it.msg)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 底部控制区 */}
          <footer className="border-t border-paper/10 px-5 py-4">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
              {stage?.k === 'answer' && pendingMsg === null && (
                <div className="flex flex-wrap justify-center gap-2 animate-fade-up">
                  {stage.options.map((o) => (
                    <button
                      key={o.label}
                      onClick={() => {
                        if (stage.check) api.check(stage.check);
                        setPendingMsg(o.msg);
                      }}
                      className="rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-[12.5px] text-accent transition hover:-translate-y-0.5"
                    >
                      {api.copy(o.label)}
                    </button>
                  ))}
                </div>
              )}
              {stage?.k === 'answer' && pendingMsg !== null && (
                <div className="flex flex-col items-center gap-2 animate-fade-up">
                  <button
                    onClick={() => (recording ? stopRec() : setRecording(true))}
                    className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl shadow-pop transition ${
                      recording ? 'bg-red-500 animate-pulse' : 'bg-accent hover:scale-105'
                    }`}
                  >
                    🎙️
                  </button>
                  <div className="flex items-center gap-2 text-[12px] text-paper/70">
                    {recording && <Waveform active className="text-red-400" />}
                    {recording
                      ? `${api.copy('call-recording')} ${fmt(recSec)} · ${api.copy('call-mic-stop')}`
                      : api.copy('call-mic-start')}
                  </div>
                </div>
              )}
              {stage?.k === 'hangup' && (
                <button
                  onClick={() => setEnded(true)}
                  className="flex items-center gap-2 rounded-full bg-red-500 px-6 py-2.5 text-[14px] font-medium shadow-pop transition hover:scale-105 animate-fade-up"
                >
                  📞 {api.copy('call-hangup')}
                </button>
              )}
              {(stage?.k === 'vo' || stage?.k === 'prep') && (
                <div className="h-16" aria-hidden />
              )}
            </div>
          </footer>
        </>
      ) : (
        /* 挂断后总结 */
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6">
          <span className="text-5xl">📞</span>
          <div className="text-center">
            <p className="text-lg font-semibold">{api.copy('call-summary-title')}</p>
            <p className="mt-1 text-[14px] tabular-nums text-paper/60">{fmt(elapsed)}</p>
            <p className="mt-3 max-w-sm text-[13.5px] leading-relaxed text-paper/80">
              {api.copy('call-summary-line')}
            </p>
          </div>
          <button
            onClick={() => onDone(fmt(elapsed))}
            className="rounded-xl bg-paper px-6 py-2.5 text-[14px] font-medium text-ink shadow-pop transition hover:-translate-y-0.5"
          >
            {api.copy('btn-back-chat')}
          </button>
        </div>
      )}
    </div>,
    document.body,
  );
};

export const formatCallLog = (tmpl: string, dur: string) => interpolate(tmpl, { dur });
