#!/usr/bin/env node
/**
 * 宣传片素材采集：用 Playwright 真玩一遍游戏，截下宣传片要用的实机画面（原始 PNG，@2x）。
 * 之后用 export_shots.py 裁切压缩成 promo/shots/*.webp。
 *
 * 前置：本地试玩模式的生产构建（不要配 .env；开发模式 StrictMode 下信封滑块不会启封）
 *   npm run build && npx vite preview --port 4173 --strictPort
 * 用法：
 *   node promo/capture.cjs [--base http://localhost:4173] [--only env,prologue,levels,home,ending]
 *                          [--levels poster,coding]   只重采这几关（其余沿用上次的通关存档）
 *   python3 promo/export_shots.py
 *
 * 产物：promo/.raw/（已 gitignore）
 *   env/f000…f048.png + final.png   信封启封逐帧
 *   named/<名字>.png                按「出现某句文案」触发的关键画面（见 LEVELS[].shots）
 *   levels/<关卡>/NN.png            每关逐步截图（挑图备用）
 *   save-*.json                     各阶段存档（localStorage 快照）
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const BASE = opt('base', 'http://localhost:4173');
const ONLY = (opt('only', 'env,prologue,levels,home,ending') || '').split(',');
const PICK = opt('levels', null)?.split(',');
const RAW = path.join(__dirname, '.raw');
const VIEW = { width: 1280, height: 800 };
const SAVE_KEY = 'unisim_save_v2';

const mk = (...p) => {
  const d = path.join(RAW, ...p);
  fs.mkdirSync(d, { recursive: true });
  return d;
};
const sleep = (p, ms) => p.waitForTimeout(ms);
const HIDE_DEV = '.fixed.bottom-3{display:none!important}';

// ---------------- 浏览器上下文：从 localStorage 存档起步，结束时导出 ----------------
async function withPage(browser, storage, fn) {
  const ctx = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2 });
  if (storage) {
    await ctx.addInitScript((kv) => {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.clear();
      for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
    }, storage);
  }
  const p = await ctx.newPage();
  p.setDefaultTimeout(4000);
  p.on('pageerror', (e) => console.log('  [page]', e.message));
  await p.goto(BASE + '/');
  await sleep(p, 1500);
  try {
    await fn(p);
  } catch (e) {
    console.log('  ! step error:', e.message.split('\n')[0]);
    await shot(p, path.join(mk('errors'), `${Date.now()}.png`));
  }
  const out = await p.evaluate(() => Object.fromEntries(Object.entries(localStorage)));
  await ctx.close();
  return out;
}
async function shot(p, file, opts = {}) {
  await p.addStyleTag({ content: HIDE_DEV }).catch(() => {});
  await p.screenshot({ path: file, timeout: 30000, ...opts });
}
async function clickButton(p, text, wait = 1500) {
  const b = p.locator('button:visible', { hasText: text }).first();
  await b.scrollIntoViewIfNeeded(); // 长页面（如结算的文件夹清单）按钮可能在视口外
  const bb = await b.boundingBox();
  await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await sleep(p, wait);
}
/** 点画面推进 VN 对白，直到出现某个元素 */
async function until(p, selector, max = 12) {
  for (let i = 0; i < max; i++) {
    if (await p.locator(selector).count()) return true;
    await p.mouse.click(640, 330);
    await sleep(p, 900);
  }
  return false;
}

// ---------------- 1 · 信封逐帧 ----------------
async function captureEnvelope(browser) {
  const dir = mk('env');
  await withPage(browser, null, async (p) => {
    await sleep(p, 800);
    await p.addStyleTag({ content: HIDE_DEV });
    const knob = await p.locator('[role=slider]').boundingBox();
    const y = knob.y + knob.height / 2;
    await p.screenshot({ path: path.join(dir, 'f000.png') });
    await p.mouse.move(knob.x + knob.width / 2, y);
    await p.mouse.down();
    const N = 48;
    for (let i = 1; i <= N; i++) {
      // 拖动中 transition 为 none，画面只由滑块位置决定：一步一截即得逐帧
      await p.mouse.move(494 + ((0.955 * i) / N) * 292, y);
      await sleep(p, 30);
      await p.screenshot({ path: path.join(dir, `f${String(i).padStart(3, '0')}.png`) });
    }
    await p.mouse.move(494 + 0.99 * 292, y);
    await sleep(p, 700);
    await p.screenshot({ path: path.join(dir, 'final.png') });
  });
  console.log('env: ok');
}

// ---------------- 2 · 序章建档 ----------------
async function capturePrologue(browser) {
  const named = mk('named');
  const save = await withPage(browser, null, async (p) => {
    await p.locator('[role=slider]').focus();
    await p.keyboard.press('Enter');
    await sleep(p, 3700);
    await p.mouse.click(640, 400);
    await sleep(p, 900);
    await p.locator('input').first().fill('林小满');
    await clickButton(p, '就是这个名字');
    await p.locator('input').first().fill('计算机');
    await sleep(p, 800);
    await clickButton(p, '计算机科学与技术', 1800);
    // 先悬停一项再截图（选项卡有高亮态），再选真正的那一项
    await p.locator('button:visible', { hasText: '年薪 10~20 万' }).first().hover();
    await sleep(p, 400);
    await shot(p, path.join(named, 'flag.png'));
    await clickButton(p, '年薪 20~30 万', 1400);
    await clickButton(p, '新一线', 1400);
    await clickButton(p, '大厂', 1400);
    await clickButton(p, '想自己安排时间', 1800);
    await clickButton(p, '本科就业', 500);
    await shot(p, path.join(named, 'path.png'));
    await clickButton(p, '就往这条路走', 1800);
    // 入学人设每次随机抽 8 张，按位置点两张
    await p.locator('button').nth(0).click();
    await sleep(p, 300);
    await p.locator('button').nth(2).click();
    await sleep(p, 500);
    await shot(p, path.join(named, 'traits.png'));
    await clickButton(p, '就是这样的我', 2500);
    await shot(p, path.join(named, 'senpai.png'));
    await p.mouse.click(640, 300);
    await until(p, 'button:visible:has-text("收下")', 10);
    await sleep(p, 1200);
    await shot(p, path.join(named, 'major.png'));
    await clickButton(p, '收下', 2200);
    // 最后一屏点画面也会推进到 Home，按钮可能已经消失：点得到就点，最后以进入 Home 为准
    await until(p, 'button:visible:has-text("开始大一")', 8);
    await p.locator('button:visible', { hasText: '开始大一' }).first().click({ timeout: 2000 }).catch(() => {});
    await p.waitForURL(/#\/home/, { timeout: 8000 });
    await sleep(p, 1500);
  });
  fs.writeFileSync(path.join(RAW, 'save-prologue.json'), JSON.stringify(save));
  console.log('prologue: ok');
  return save;
}

// ---------------- 存档构造 ----------------
const BOARDS = {
  y1s1: ['course-select', 'poster'],
  y1s2: ['ppt', 'coding'],
  y2s1: ['mentor', 'notes'],
  y2s2: ['dachuang', 'gig'],
  y3s1: ['resume', 'examiner'],
  y3s2: ['fork', 'interview'],
  y4: ['thesis'],
};
const semesterOf = (level) => Object.keys(BOARDS).find((s) => BOARDS[s].includes(level));
function withSave(storage, patch, extra = {}) {
  const s = JSON.parse(storage[SAVE_KEY]);
  return { ...storage, [SAVE_KEY]: JSON.stringify({ ...s, ...patch }), unisim_tour_v1: '1', ...extra };
}
function levelStorage(base, level) {
  const sem = semesterOf(level);
  const ml = BOARDS[sem];
  return withSave(base, {
    semester: sem,
    completedActions: ml.slice(0, ml.indexOf(level)),
    axes: { academic: 5, portfolio: 4, expression: 4, cash: 3, energy: 4 },
  });
}

// ---------------- 3 · 主线关卡：通用自动驾驶 + 按文案触发的关键截图 ----------------
const LEVELS = [
  { id: 'course-select', shots: [['cs', '点击打开全文']] },
  {
    id: 'poster',
    prefer: /竖版|生成|发给学姐|二维码|剪映|完成这一步|交付|收进|加上|风格/,
    once: /竖版|风格|加上/,
    avoid: /横版/,
    shots: [['poster-chat', '让 AI 把二维码画上去']],
  },
  { id: 'ppt', shots: [['ppt', '学长的 PPT 工具横评擂台']] },
  { id: 'coding', prefer: /Trae/, once: /Trae/, shots: [['coding-f12', '复制报错'], ['coding-site', '下载 index.html']] },
  { id: 'mentor' },
  { id: 'notes' },
  { id: 'dachuang', shots: [['dachuang', '无法确认存在']] },
  { id: 'gig' },
  { id: 'resume' },
  { id: 'examiner', shots: [['examiner', 'Finally, Part Three']] },
  { id: 'fork' },
  { id: 'interview' },
  { id: 'thesis', shots: [['thesis', '开题通过了']] },
];
// 不点的按钮：离开/求助/收起类，任务清单开关，以及 AI 产出的文档卡（点开是长文档阅读器，目录按钮会把自动驾驶困住）
const SKIP = /返回主页|问学长|发送|✕|关闭|收起|上一张|重新开始|再想想|新手引导|的要求|目标 \d|\d\/\d|打开全文/;

async function autoplay(p, L, dir, named) {
  await p.goto(`${BASE}/#/level/${L.id}`);
  await sleep(p, 2500);
  const taken = new Set();
  const clickedOnce = new Set();
  for (let i = 0; i < 42; i++) {
    await shot(p, path.join(dir, `${String(i).padStart(2, '0')}.png`));
    for (const [name, text] of L.shots || []) {
      if (taken.has(name)) continue;
      if (await p.getByText(text).first().isVisible().catch(() => false)) {
        await shot(p, path.join(named, `${name}.png`));
        taken.add(name);
      }
    }
    if (!p.url().includes('/level/')) break;
    let acted = false;
    try {
      // 优先级：可投喂文件（双击投喂）→ 提示词 chip → 推进按钮 → 点画面推进对白
      const drag = p.locator('div[draggable=true].border-accent:visible, img[draggable=true]:visible').first();
      if (await drag.count()) {
        await drag.dblclick();
        acted = true;
      }
      if (!acted) {
        const chips = p.locator('button.rounded-full.bg-accent-soft:visible');
        if (await chips.count()) {
          await chips.first().click();
          acted = true;
        }
      }
      if (!acted) {
        let cand = null;
        let ct = '';
        let pref = null;
        let pt = '';
        for (const b of await p.locator('button:visible').all()) {
          const t = (await b.innerText()).trim().replace(/\s+/g, ' ');
          if (!t || SKIP.test(t) || (await b.isDisabled())) continue;
          if (L.avoid && L.avoid.test(t)) continue;
          if (L.once && L.once.test(t) && clickedOnce.has(t)) continue;
          if (L.prefer && L.prefer.test(t) && !pref) {
            pref = b;
            pt = t;
          }
          cand = b;
          ct = t;
        }
        if (pref) {
          cand = pref;
          ct = pt;
        }
        if (cand) {
          if (L.once && L.once.test(ct)) clickedOnce.add(ct);
          await cand.click();
          acted = true;
        }
      }
    } catch {
      acted = false;
    }
    if (!acted) await p.mouse.click(640, 330);
    await sleep(p, 2200);
  }
  const missing = (L.shots || []).filter(([n]) => !taken.has(n)).map(([n]) => n);
  if (missing.length) console.log(`  ! ${L.id}: 没等到触发文案 → ${missing.join(', ')}`);
}

async function captureLevels(browser, base) {
  const named = mk('named');
  const prev = path.join(RAW, 'save-levels.json');
  const outs = PICK && fs.existsSync(prev) ? JSON.parse(fs.readFileSync(prev, 'utf8')) : {};
  for (const L of LEVELS.filter((x) => !PICK || PICK.includes(x.id))) {
    const dir = mk('levels', L.id);
    outs[L.id] = await withPage(browser, levelStorage(base, L.id), (p) => autoplay(p, L, dir, named));
    console.log(`level ${L.id}: ok`);
  }
  fs.writeFileSync(path.join(RAW, 'save-levels.json'), JSON.stringify(outs));
  return outs;
}

/** 把各关通关存档里的产出、能力合并成一份「玩到大四」的存档 */
function lateStorage(base, outs, semester, done) {
  const b = JSON.parse(base[SAVE_KEY]);
  const archive = new Map(b.archive.map((a) => [a.id, a]));
  const abilities = [...b.abilities];
  for (const L of LEVELS) {
    if (!outs[L.id]) continue;
    const s = JSON.parse(outs[L.id][SAVE_KEY]);
    for (const a of s.archive) if (!archive.has(a.id)) archive.set(a.id, { ...a, borrowed: false, semester: semesterOf(L.id) });
    for (const ab of s.abilities) if (!abilities.includes(ab)) abilities.push(ab);
  }
  const axes = { academic: 9, portfolio: 11, expression: 8, cash: 6, energy: 5 };
  const claims = Object.fromEntries(
    [...archive.keys()].filter((id) => id.startsWith('prompt-')).map((id) => [id, 1760000000000]),
  );
  return withSave(
    base,
    {
      semester,
      completedActions: done,
      archive: [...archive.values()],
      abilities,
      axes,
      axesPeak: axes,
      tags: { maker: 4, voice: 3, grind: 2, night: 2 },
      gpaHistory: { y1s1: 3.52, y1s2: 3.61, y2s1: 3.7, y2s2: 3.66, y3s1: 3.78, y3s2: 3.81 },
      semesterAcademicStart: 7,
    },
    { unisim_prompt_claims_v1: JSON.stringify(claims) },
  );
}

// ---------------- 4 · Home：宿舍 / 校园地图 / 文件夹 / 属性 ----------------
async function captureHome(browser, base, outs) {
  const named = mk('named');
  const early = levelStorage(base, 'course-select');
  await withPage(browser, early, async (p) => {
    await p.goto(BASE + '/#/home');
    await sleep(p, 2500);
    await shot(p, path.join(named, 'home.png'));
    await clickButton(p, '出门', 2500);
    await shot(p, path.join(named, 'map.png'));
  });
  await withPage(browser, lateStorage(base, outs, 'y3s1', []), async (p) => {
    await p.goto(BASE + '/#/home');
    await sleep(p, 2500);
    await clickButton(p, '文件夹', 3500); // 等作品牌堆的入场动画走完
    await shot(p, path.join(named, 'folder.png'));
    await clickButton(p, '收起', 1200);
    await clickButton(p, '属性', 1800);
    await shot(p, path.join(named, 'stats.png'));
  });
  console.log('home: ok');
}

// ---------------- 5 · 毕业档案长卡 ----------------
async function captureEnding(browser, base, outs) {
  const named = mk('named');
  await withPage(browser, lateStorage(base, outs, 'y4', ['thesis']), async (p) => {
    await p.goto(BASE + '/#/settlement');
    await sleep(p, 2500);
    await clickButton(p, '看看文件夹', 2200);
    await clickButton(p, '生成学期小卡', 3000);
    await shot(p, path.join(named, 'grad-card.png'), { fullPage: true });
  });
  console.log('ending: ok');
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });
  const browser = await chromium.launch();
  const savePath = path.join(RAW, 'save-prologue.json');
  const levelsPath = path.join(RAW, 'save-levels.json');
  if (ONLY.includes('env')) await captureEnvelope(browser);
  const base = ONLY.includes('prologue') || !fs.existsSync(savePath)
    ? await capturePrologue(browser)
    : JSON.parse(fs.readFileSync(savePath, 'utf8'));
  const outs = ONLY.includes('levels') || !fs.existsSync(levelsPath)
    ? await captureLevels(browser, base)
    : JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
  if (ONLY.includes('home')) await captureHome(browser, base, outs);
  if (ONLY.includes('ending')) await captureEnding(browser, base, outs);
  await browser.close();
  console.log('done →', RAW);
})();
