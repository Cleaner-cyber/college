/**
 * 元进度（docs/08 P3）：跨局只解锁内容不继承数值。
 * 毕业时按身份卡解锁传承特质（进下一局序章卡池）并记录结局名（序章「学长的信」）。
 * 存本机 localStorage（META_KEY）；清档重开不清除——轮回的意义就在这。
 */
import { META_KEY, type MetaState, type PlayerState } from '@/contracts';
import type { EndingDef } from '@/contracts';
import { traits } from './content';

function emptyMeta(): MetaState {
  return { runs: 0, unlockedTraits: [] };
}

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return emptyMeta();
    const parsed = JSON.parse(raw) as MetaState;
    return {
      runs: typeof parsed.runs === 'number' ? parsed.runs : 0,
      unlockedTraits: Array.isArray(parsed.unlockedTraits) ? parsed.unlockedTraits : [],
      lastEndingTitle: parsed.lastEndingTitle,
    };
  } catch {
    return emptyMeta();
  }
}

/** 毕业记账：局数 +1、解锁身份卡对应的传承特质、记录结局名 */
export function recordGraduation(ending: EndingDef): MetaState {
  const meta = loadMeta();
  const next: MetaState = {
    runs: meta.runs + 1,
    unlockedTraits:
      ending.legacy && !meta.unlockedTraits.includes(ending.legacy)
        ? [...meta.unlockedTraits, ending.legacy]
        : meta.unlockedTraits,
    lastEndingTitle: ending.title,
  };
  try {
    localStorage.setItem(META_KEY, JSON.stringify(next));
  } catch {
    /* 存不进就算了，元进度不是关键路径 */
  }
  return next;
}

/** 序章卡池：基础特质全量 + 已解锁的传承特质 */
export function unlockedLegacyTraits(): PlayerState['traits'] {
  const meta = loadMeta();
  return traits.filter((t) => t.legacy && meta.unlockedTraits.includes(t.id)).map((t) => t.id);
}
