/** 关卡注册表：引擎按 id 查找关卡插件并注入内容。 */
import type { LevelModule } from '@/contracts';
import { PrologueLevel } from '@/levels/prologue';
import { CourseSelectLevel } from '@/levels/course-select';
import { PosterLevel } from '@/levels/poster';
import { PptLevel } from '@/levels/ppt';
import { SettlementLevel } from '@/levels/settlement';

export const levelRegistry: Record<string, LevelModule> = {
  [PrologueLevel.id]: PrologueLevel,
  [CourseSelectLevel.id]: CourseSelectLevel,
  [PosterLevel.id]: PosterLevel,
  [PptLevel.id]: PptLevel,
  [SettlementLevel.id]: SettlementLevel,
};
