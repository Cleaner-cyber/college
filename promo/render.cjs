#!/usr/bin/env node
/**
 * 宣传片渲染器：起一个本地静态服务（仓库根目录）→ Playwright 打开 promo/trailer.html →
 * 逐帧 __seek(t) 截图 → 管道喂给 ffmpeg，混入 soundtrack.wav，输出 H.264 + AAC 的 MP4。
 *
 * 用法（在仓库根目录）：
 *   python3 promo/soundtrack.py                         # 先生成配乐 promo/out/soundtrack.wav
 *   node promo/render.cjs                               # 横版 1920×1080 → promo/out/trailer-16x9.mp4
 *   node promo/render.cjs --layout portrait             # 竖版 1080×1920 → promo/out/trailer-9x16.mp4
 *   node promo/render.cjs --stills 0.5,10,40            # 只出几张静帧 PNG 预览（promo/out/stills/）
 *   node promo/render.cjs --from 36 --to 54             # 只渲一段（调某个场景时用）
 *
 * 依赖：Playwright（chromium）、ffmpeg。需先 npm install（字体来自 lxgw-wenkai-lite-webfont）。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'out');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const layout = opt('layout', 'landscape');
const stills = opt('stills', null);
const from = parseFloat(opt('from', '0'));
const toArg = opt('to', null);
const workers = parseInt(opt('workers', '3'), 10);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const file = path.normalize(path.join(ROOT, rel));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

async function openPage(browser, port) {
  const portrait = layout === 'portrait';
  const page = await browser.newPage({
    viewport: portrait ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  page.on('pageerror', (e) => console.error('[page]', e.message));
  await page.goto(`http://127.0.0.1:${port}/promo/trailer.html?layout=${layout}`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  return page;
}

async function frameAt(page, t, type = 'jpeg') {
  await page.evaluate((tt) => window.__seek(tt), t);
  return page.screenshot(type === 'png' ? { type: 'png' } : { type: 'jpeg', quality: 94 });
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const srv = await serve();
  const port = srv.address().port;
  const browser = await chromium.launch();

  if (stills) {
    const dir = path.join(OUT, 'stills');
    fs.mkdirSync(dir, { recursive: true });
    const page = await openPage(browser, port);
    for (const s of stills.split(',')) {
      const t = parseFloat(s);
      const buf = await frameAt(page, t, 'png');
      const f = path.join(dir, `${layout}-${t.toFixed(2)}.png`);
      fs.writeFileSync(f, buf);
      console.log('still', f);
    }
    await browser.close();
    srv.close();
    return;
  }

  const probe = await openPage(browser, port);
  const [duration, fps] = await probe.evaluate(() => [window.__duration, window.__fps]);
  await probe.close();
  const to = toArg ? parseFloat(toArg) : duration;
  const first = Math.round(from * fps);
  const last = Math.round(to * fps);
  const total = last - first;
  const tag = layout === 'portrait' ? '9x16' : '16x9';
  const partial = from > 0 || toArg;
  const outFile = path.join(OUT, `trailer-${tag}${partial ? `-${from}-${to}` : ''}.mp4`);
  const audio = path.join(OUT, 'soundtrack.wav');

  // 多页并行截图，按帧序写入 ffmpeg
  const pages = await Promise.all(Array.from({ length: workers }, () => openPage(browser, port)));
  const ffArgs = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-'];
  if (fs.existsSync(audio)) {
    ffArgs.push('-ss', String(from), '-i', audio, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
  }
  ffArgs.push(
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-profile:v', 'high', '-movflags', '+faststart', '-r', String(fps),
    '-t', String(total / fps), outFile,
  );
  const ff = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'inherit', 'inherit'] });
  const write = (buf) => new Promise((res) => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));

  const started = Date.now();
  const ahead = new Map();
  let next = first;
  let issued = first;
  async function worker(page) {
    while (issued < last) {
      const f = issued++;
      const buf = await frameAt(page, f / fps);
      ahead.set(f, buf);
      while (ahead.has(next)) {
        // 先取走再 await：别的 worker 不会重复写同一帧；stdin.write 同步入队，帧序不乱
        const buf = ahead.get(next);
        ahead.delete(next);
        const done = ++next - first;
        await write(buf);
        if (done % (fps * 10) === 0) {
          const el = (Date.now() - started) / 1000;
          console.log(`  ${(done / fps).toFixed(0)}s / ${(total / fps).toFixed(0)}s  (${el.toFixed(0)}s elapsed)`);
        }
      }
    }
  }
  await Promise.all(pages.map(worker));
  ff.stdin.end();
  await new Promise((res) => ff.on('close', res));
  await browser.close();
  srv.close();
  console.log('wrote', outFile);
})();
