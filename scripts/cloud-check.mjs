#!/usr/bin/env node
/**
 * 云端联调自检：拿到 Supabase 项目凭据后跑一遍，验证 认证 → 云存档 → RLS 全链路。
 *
 * 用法：
 *   VITE_SUPABASE_URL=https://xxx.supabase.co VITE_SUPABASE_ANON_KEY=xxx node scripts/cloud-check.mjs
 *
 * 检查项：
 *   1. 注册（随机测试邮箱）→ 2. 登录 → 3. upsert 云存档 → 4. 读回并比对
 *   → 5. RLS：匿名客户端读不到任何存档 → 6. 更新存档（模拟二次进度）→ 7. 清理（删档+登出）
 * 若项目开启了「邮箱确认」，注册后无会话，脚本会提示先在 Dashboard 关掉 Confirm email 再跑。
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('缺环境变量：VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const ok = (label) => console.log(`  ✓ ${label}`);
const fail = (label, extra) => {
  console.error(`  ✗ ${label}`, extra ?? '');
  process.exit(1);
};

const client = createClient(url, key, { auth: { persistSession: false } });
const email = `unisim-check-${Date.now()}@example.com`;
const password = `Uc-${Math.random().toString(36).slice(2, 10)}!9`;

console.log('云端联调自检 →', url);

// 1. 注册
const { data: signUpData, error: signUpErr } = await client.auth.signUp({ email, password });
if (signUpErr) fail('注册', signUpErr.message);
if (!signUpData.session) {
  console.error('  ✗ 注册成功但无会话：项目开启了「Confirm email」。');
  console.error('    去 Dashboard → Authentication → Sign In / Up → 关闭 Confirm email 后重跑。');
  process.exit(1);
}
ok(`注册 ${email}`);
const userId = signUpData.user.id;

// 2.（幂等）登录
const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
if (signInErr) fail('登录', signInErr.message);
ok('登录');

// 3. 写云存档（最小合法 PlayerState 骨架，version 对齐 contracts）
const state = {
  version: 2,
  semester: 'y1s1',
  player: { name: '联调测试', majorId: 'test' },
  axes: { academic: 1, portfolio: 1, expression: 1, cash: 1, energy: 5 },
  actionPoints: 3,
  completedActions: [],
  archive: [],
  abilities: [],
  traits: [],
  tags: {},
  flag: { salaryBand: '-', city: '-', workStyle: '-', offTime: '-' },
  pathGoal: null,
  log: [],
};
const { error: upsertErr } = await client
  .from('game_saves')
  .upsert({ user_id: userId, state, updated_at: new Date().toISOString() });
if (upsertErr) fail('写入云存档（先确认 supabase/schema.sql 已在 SQL Editor 执行）', upsertErr.message);
ok('写入云存档');

// 4. 读回比对
const { data: row, error: loadErr } = await client
  .from('game_saves')
  .select('state, semester')
  .eq('user_id', userId)
  .maybeSingle();
if (loadErr || !row) fail('读回云存档', loadErr?.message);
if (row.state.player.name !== '联调测试') fail('读回内容比对');
if (row.semester !== 'y1s1') fail('semester 冗余列（generated column）');
ok('读回比对（含 semester 冗余列）');

// 5. RLS：匿名客户端什么都读不到
const anon = createClient(url, key, { auth: { persistSession: false } });
const { data: anonRows, error: anonErr } = await anon.from('game_saves').select('user_id');
if (anonErr) ok(`RLS 匿名读被拒（${anonErr.code ?? 'error'}）`);
else if ((anonRows ?? []).length === 0) ok('RLS 匿名读为空');
else fail('RLS 失效：匿名能读到存档行！检查 schema.sql 的 policy 是否执行');

// 6. 更新（模拟二次进度）
const { error: updErr } = await client
  .from('game_saves')
  .upsert({ user_id: userId, state: { ...state, semester: 'y1s2' }, updated_at: new Date().toISOString() });
if (updErr) fail('更新云存档', updErr.message);
ok('更新云存档');

// 7. 清理
await client.from('game_saves').delete().eq('user_id', userId);
await client.auth.signOut();
ok('清理（删档+登出；测试账号请在 Dashboard → Authentication 里手动删除）');

console.log('\n全链路通过 ✅  可以把这两个环境变量配到 Zeabur 上线了。');
