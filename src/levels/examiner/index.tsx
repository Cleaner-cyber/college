/**
 * 雅思口语陪练关：教学「口语陪练」。大三上主线必修 · 全预设演出。
 * 设定考官角色（文字）→ 接通语音模拟（全屏通话层：考官朗读 Part 1-3、玩家按麦作答）→
 * 挂断回对话：切教练要结构化点评 → 30 天陪练计划。
 */
import React, { useEffect, useRef, useState } from 'react';
import type { LevelModule, LevelProps, LevelResult } from '@/contracts';
import { ScreenPlayer, type FlowAPI } from '@/engine/ScreenPlayer';
import { ui } from '@/engine/content';
import { Button } from '@/components/ui/Button';
import { TaskPanel } from '@/components/ui/TaskPanel';
import { renderMarkdown } from '@/components/ui/Markdown';
import { SenpaiAvatar } from '@/components/ui/SpeakerTag';
import { DeliverScreen, EscapeOverlay } from '@/components/chat/DeliverScreen';
import { VoiceCall, formatCallLog } from './VoiceCall';

type Step =
  | { k: 'senpai'; key: string }
  | { k: 'chip'; label: string; prompt: string; check?: string }
  | { k: 'ai'; key: string }
  | { k: 'call' }
  | { k: 'button'; key: string };

const STEPS: Step[] = [
  { k: 'senpai', key: 'senpai-tip-1' },
  { k: 'chip', label: 'chip-setup', prompt: 'q-setup', check: 'ck-role' },
  { k: 'ai', key: 'a-setup' },
  { k: 'senpai', key: 'senpai-tip-2' },
  { k: 'call' },
  { k: 'senpai', key: 'senpai-after-call' },
  { k: 'chip', label: 'chip-feedback', prompt: 'q-feedback', check: 'ck-feedback' },
  { k: 'ai', key: 'a-feedback' },
  { k: 'senpai', key: 'senpai-tip-4' },
  { k: 'chip', label: 'chip-plan', prompt: 'q-plan', check: 'ck-plan' },
  { k: 'ai', key: 'a-plan' },
  { k: 'senpai', key: 'senpai-wrap' },
  { k: 'button', key: 'btn-deliver' },
];

type Msg =
  | { kind: 'user'; text: string }
  | { kind: 'ai'; text: string; done: boolean }
  | { kind: 'senpai'; text: string }
  | { kind: 'calllog'; dur: string };

const Thinking: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2 text-[13px] text-ink-soft">
    <span className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
          style={{ animationDelay: `${i * 0.25}s` }}
        />
      ))}
    </span>
    {label}
  </div>
);

const SpeakingChat: React.FC<{ api: FlowAPI }> = ({ api }) => {
  const [idx, setIdx] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [inputText, setInputText] = useState('');
  const [typingText, setTypingText] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamCount, setStreamCount] = useState(0);
  const [inCall, setInCall] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const step = STEPS[idx] as Step | undefined;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, streamCount, thinking, inputText]);

  // 提示词打字时输入框自动滚到最新一行
  useEffect(() => {
    const el = inputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [inputText]);

  // 自动步骤：senpai / ai
  useEffect(() => {
    if (!step) return;
    if (step.k === 'senpai') {
      const t = window.setTimeout(() => {
        setMsgs((m) => [...m, { kind: 'senpai', text: api.copy(step.key) }]);
        setIdx((i) => i + 1);
      }, 380);
      return () => window.clearTimeout(t);
    }
    if (step.k === 'ai') {
      setThinking(true);
      const t = window.setTimeout(() => {
        setThinking(false);
        setMsgs((m) => [...m, { kind: 'ai', text: api.copy(step.key), done: false }]);
        setStreamCount(0);
        setStreaming(true);
      }, 1400);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // 流式输出
  useEffect(() => {
    if (!streaming || !step || step.k !== 'ai') return;
    const full = api.copy(step.key);
    if (streamCount >= full.length) {
      setMsgs((m) => m.map((msg) => (msg.kind === 'ai' ? { ...msg, done: true } : msg)));
      setStreaming(false);
      setIdx((i) => i + 1);
      return;
    }
    const t = window.setTimeout(() => setStreamCount((c) => Math.min(full.length, c + 9)), 14);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, streamCount, idx]);

  // chip 打字动画 → 发送
  useEffect(() => {
    if (typingText === null) return;
    let i = 0;
    const t = window.setInterval(() => {
      i = Math.min(typingText.length, i + 4);
      setInputText(typingText.slice(0, i));
      if (i >= typingText.length) {
        window.clearInterval(t);
        window.setTimeout(() => {
          setInputText('');
          setMsgs((m) => [...m, { kind: 'user', text: typingText }]);
          setTypingText(null);
          setIdx((v) => v + 1);
        }, 420);
      }
    }, 20);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typingText]);

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-accent-soft/60 p-2.5 text-[12px] leading-relaxed text-ink-soft">
        {api.copy('s3-steps')}
      </p>

      <div className="flex h-[560px] flex-col overflow-hidden rounded-2xl border-2 border-line bg-card shadow-soft">
        <div className="flex items-center gap-2 border-b border-line bg-paper/60 px-4 py-2.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="h-2 w-2 rounded-full bg-line" />
            <span className="h-2 w-2 rounded-full bg-line" />
          </span>
          <span className="ml-1 text-[13px] font-medium">{api.copy('chat-title')}</span>
          {streaming && (
            <span className="ml-auto text-[11px] text-ink-soft">{api.copy('chat-skip-hint')}</span>
          )}
        </div>

        {/* 消息区 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            {msgs.map((m, i) => {
              if (m.kind === 'user') {
                return (
                  <div key={i} className="flex justify-end animate-fade-up">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[13px] leading-relaxed text-paper">
                      {m.text}
                    </div>
                  </div>
                );
              }
              if (m.kind === 'senpai') {
                return (
                  <div key={i} className="flex items-start gap-2 py-1 animate-fade-up">
                    <SenpaiAvatar size={26} />
                    <p className="whitespace-pre-wrap pt-0.5 text-[12.5px] leading-relaxed text-accent">
                      {m.text}
                    </p>
                  </div>
                );
              }
              if (m.kind === 'calllog') {
                return (
                  <div key={i} className="flex justify-center animate-fade-up">
                    <span className="flex items-center gap-2 rounded-full border border-line bg-paper px-4 py-1.5 text-[12px] text-ink-soft">
                      📞 {formatCallLog(api.copy('calllog-line'), m.dur)}
                    </span>
                  </div>
                );
              }
              const isLast = i === msgs.length - 1;
              const shown = !m.done && isLast && streaming ? m.text.slice(0, streamCount) : m.text;
              return (
                <div key={i} className="flex justify-start animate-fade-up">
                  <div
                    onClick={() => {
                      if (!m.done && streaming) setStreamCount(m.text.length);
                    }}
                    className="max-w-[92%] rounded-2xl rounded-tl-md border border-line/70 bg-paper px-4 py-3 shadow-soft"
                  >
                    {renderMarkdown(shown)}
                    {!m.done && isLast && <span className="animate-pulse text-accent">▍</span>}
                  </div>
                </div>
              );
            })}
            {thinking && <Thinking label={api.copy('chat-thinking')} />}
          </div>
        </div>

        {/* 输入区 */}
        <div className="border-t border-line px-4 py-3">
          {step?.k === 'chip' && typingText === null && (
            <button
              onClick={() => {
                if (step.check) api.check(step.check);
                setTypingText(api.copy(step.prompt));
              }}
              className="mb-2.5 rounded-full border border-accent/60 bg-accent-soft px-3.5 py-1.5 text-left text-[12.5px] text-accent transition hover:-translate-y-0.5 hover:shadow-soft animate-fade-up"
            >
              {api.copy(step.label)}
            </button>
          )}
          {step?.k === 'call' && !inCall && (
            <div className="mb-2.5 animate-fade-up">
              <Button
                onClick={() => {
                  // 用本次点击的用户激活解锁 speechSynthesis（部分浏览器无激活不发声）
                  try {
                    const synth = window.speechSynthesis;
                    if (synth) {
                      synth.cancel();
                      synth.speak(new SpeechSynthesisUtterance(' '));
                      synth.resume();
                    }
                  } catch {
                    /* 忽略：不支持语音的环境走字幕演出 */
                  }
                  setInCall(true);
                }}
              >
                {api.copy('btn-call')}
              </Button>
            </div>
          )}
          {step?.k === 'button' && (
            <div className="mb-2.5 animate-fade-up">
              <Button onClick={api.advance}>{api.copy(step.key)}</Button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <div
              ref={inputRef}
              className={`max-h-[130px] min-h-[42px] flex-1 overflow-y-auto whitespace-pre-wrap rounded-xl border border-line bg-paper px-3.5 py-2.5 text-[13px] leading-relaxed ${
                inputText ? 'text-ink' : 'text-ink-soft/60'
              }`}
            >
              {inputText || api.copy('chat-input-placeholder')}
              {typingText !== null && <span className="animate-pulse text-accent">▍</span>}
            </div>
            <button
              disabled
              className="rounded-xl bg-ink px-4 py-2.5 text-[13px] text-paper opacity-40"
            >
              {ui.common.confirm}
            </button>
          </div>
        </div>
      </div>

      {inCall && (
        <VoiceCall
          api={api}
          onDone={(dur) => {
            setInCall(false);
            setMsgs((m) => [...m, { kind: 'calllog', dur }]);
            setIdx((i) => i + 1);
          }}
        />
      )}
    </div>
  );
};

const ExaminerComponent: React.FC<LevelProps> = ({ state, content, onComplete, onEscape }) => {
  const [checked, setChecked] = useState<string[]>([]);
  const checklist = content.checklist ?? [];

  const buildResult = (borrowed: boolean, done: number): LevelResult => ({
    deltas: { expression: !borrowed && done === checklist.length ? 2 : 1 },
    abilityUnlocks: ['examiner'],
    checklistScore: { done, total: checklist.length },
    archiveItems: [
      {
        id: 'ielts-speaking',
        levelId: 'examiner',
        title: borrowed ? content.copy['archive-title-borrowed'] : content.copy['archive-title'],
        resumeLine: borrowed
          ? content.copy['archive-resume-line-borrowed']
          : content.copy['archive-resume-line'],
        borrowed,
      },
      {
        id: 'prompt-examiner',
        levelId: 'examiner',
        title: content.copy['prompt-item-title'],
        resumeLine: '',
        borrowed: false,
      },
    ],
  });

  return (
    <>
      <TaskPanel items={checklist} checked={checked} title={content.copy['checklist-title']} />
      <ScreenPlayer
        content={content}
        globalVars={{ playerName: state.player.name }}
        defaultNextLabel={ui.common.continue}
        senpaiLabel={ui.board['senpai-prefix']}
        wideScreens={['S3']}
        onCheckChange={setChecked}
        custom={{
          S3: (api) => <SpeakingChat api={api} />,
          S10: (api) => (
            <DeliverScreen
              api={api}
              total={checklist.length}
              onDone={() => onComplete(buildResult(false, api.checked.length))}
            />
          ),
          ESC: (api) => (
            <DeliverScreen
              api={api}
              total={checklist.length}
              escape
              onDone={() => onEscape(buildResult(true, api.checked.length))}
            />
          ),
        }}
        overlay={(api) => <EscapeOverlay api={api} />}
        onFinish={(r) => onComplete(buildResult(false, r.checked.length))}
      />
    </>
  );
};

export const ExaminerLevel: LevelModule = { id: 'examiner', Component: ExaminerComponent };
