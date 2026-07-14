-- 大学模拟器 · 数据库结构
-- 在 Supabase Dashboard → SQL Editor 里整段执行一次即可。

-- 云存档：每个用户一行，state 为完整 PlayerState（结构见 docs/02_数据契约.md）
create table if not exists public.game_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb       not null,
  -- 冗余列：便于后台按学期/进度做统计（为将来的相对分布/稀有度留管道，见 docs/01）
  semester   text generated always as (state ->> 'semester') stored,
  updated_at timestamptz not null default now()
);

-- 行级安全：只允许本人读写自己的存档
alter table public.game_saves enable row level security;

drop policy if exists "own save - select" on public.game_saves;
create policy "own save - select" on public.game_saves
  for select using (auth.uid() = user_id);

drop policy if exists "own save - insert" on public.game_saves;
create policy "own save - insert" on public.game_saves
  for insert with check (auth.uid() = user_id);

drop policy if exists "own save - update" on public.game_saves;
create policy "own save - update" on public.game_saves
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own save - delete" on public.game_saves;
create policy "own save - delete" on public.game_saves
  for delete using (auth.uid() = user_id);

-- 统计用索引
create index if not exists game_saves_semester_idx on public.game_saves (semester);
create index if not exists game_saves_updated_at_idx on public.game_saves (updated_at);
