/** 关卡注册表：引擎按 id 查找关卡插件并注入内容。 */
import type { LevelModule } from '@/contracts';
import { PrologueLevel } from '@/levels/prologue';
import { CourseSelectLevel } from '@/levels/course-select';
import { PosterLevel } from '@/levels/poster';
import { PptLevel } from '@/levels/ppt';
import { CodingLevel } from '@/levels/coding';
import { MentorLevel } from '@/levels/mentor';
import { NotesLevel } from '@/levels/notes';
import { DachuangLevel } from '@/levels/dachuang';
import { GigLevel } from '@/levels/gig';
import { ResumeLevel } from '@/levels/resume';
import { ExaminerLevel } from '@/levels/examiner';
import { ForkLevel } from '@/levels/fork';
import { InterviewLevel } from '@/levels/interview';
import { ThesisLevel } from '@/levels/thesis';
import { SettlementLevel } from '@/levels/settlement';

export const levelRegistry: Record<string, LevelModule> = {
  [PrologueLevel.id]: PrologueLevel,
  [CourseSelectLevel.id]: CourseSelectLevel,
  [PosterLevel.id]: PosterLevel,
  [PptLevel.id]: PptLevel,
  [CodingLevel.id]: CodingLevel,
  [MentorLevel.id]: MentorLevel,
  [NotesLevel.id]: NotesLevel,
  [DachuangLevel.id]: DachuangLevel,
  [GigLevel.id]: GigLevel,
  [ResumeLevel.id]: ResumeLevel,
  [ExaminerLevel.id]: ExaminerLevel,
  [ForkLevel.id]: ForkLevel,
  [InterviewLevel.id]: InterviewLevel,
  [ThesisLevel.id]: ThesisLevel,
  [SettlementLevel.id]: SettlementLevel,
};
