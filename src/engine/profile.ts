/**
 * 序章建档服务（引擎职责）：PlayerState 的姓名/专业/flag 在序章期间逐步写入。
 * 通过 Context 注入序章关卡，避免关卡直接接触 store。
 */
import { createContext, useContext } from 'react';
import type { PlayerState } from '@/contracts';

export interface ProfileService {
  setName: (name: string) => void;
  setMajor: (majorId: string) => void;
  setFlag: (patch: Partial<PlayerState['flag']>) => void;
  setTraits: (traitIds: string[]) => void; // 入学特质（v2.1 模拟层）
}

export const ProfileContext = createContext<ProfileService | null>(null);

export function useProfile(): ProfileService {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('ProfileContext missing');
  return ctx;
}
