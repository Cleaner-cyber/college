/**
 * 宣传片合成层：整片是时间 t（秒）的纯函数——window.__seek(t) 画出任意一帧，
 * render.cjs 逐帧截图交给 ffmpeg。文案与时间轴全部来自 trailer.json（本文件不写面向观众的文案），
 * 画面素材是 promo/shots 里的实机截图 + public/assets 里的游戏原图。
 *
 * URL 参数：?layout=landscape（1920×1080，默认）| portrait（1080×1920，竖版短视频）
 *          ?t=12.5   打开即定格到该秒（调试/预览用）
 */
(async () => {
  const params = new URLSearchParams(location.search);
  const PORTRAIT = params.get('layout') === 'portrait';
  const W = PORTRAIT ? 1080 : 1920;
  const H = PORTRAIT ? 1920 : 1080;
  const P = (land, port) => (PORTRAIT ? port : land);

  const CFG = await (await fetch('trailer.json')).json();
  const S = CFG.scenes;
  document.title = CFG.meta.title;

  const stage = document.getElementById('stage');
  stage.style.width = W + 'px';
  stage.style.height = H + 'px';

  // ---------------- 数学 ----------------
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const prog = (t, a, b) => clamp((t - a) / (b - a));
  const eOut = (p) => 1 - Math.pow(1 - p, 3);
  const eIn = (p) => p * p * p;
  const eInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const eSine = (p) => -(Math.cos(Math.PI * p) - 1) / 2;
  const eBack = (p) => {
    const c = 1.2;
    return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
  };
  /** 在 at 时刻用 dur 秒入场（0→1） */
  const appear = (t, at, dur = 0.55) => eOut(prog(t, at, at + dur));
  /** 场景窗口：a 前后淡入、b 前后淡出 */
  const windowOp = (t, a, b, fin = 0.4, fout = 0.4) =>
    Math.min(prog(t, a - fin / 2, a + fin / 2), 1 - prog(t, b - fout / 2, b + fout / 2));
  const pad2 = (n) => String(n).padStart(2, '0');

  // ---------------- DOM ----------------
  function el(tag, cls, parent, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    (parent || stage).appendChild(e);
    return e;
  }
  function css(e, o) {
    Object.assign(e.style, o);
    return e;
  }
  function box(e, x, y, w, h) {
    e.style.left = x + 'px';
    e.style.top = y + 'px';
    if (w != null) e.style.width = w + 'px';
    if (h != null) e.style.height = h + 'px';
    return e;
  }
  /** 淡入 + 上移入场 */
  function fadeUp(e, a, dy = 18) {
    e.style.opacity = a;
    e.style.transform = `translateY(${(1 - a) * dy}px)`;
  }
  /** 统一的文字块：kicker / head / sub */
  function textBlock(parent, x, y, w, align, parts) {
    const wrap = el('div', 'abs', parent);
    box(wrap, x, y, w);
    wrap.style.textAlign = align;
    const out = {};
    for (const [key, cls, text, size, extra] of parts) {
      const e = el('div', cls, wrap, text);
      css(e, { fontSize: size + 'px', ...(extra || {}) });
      out[key] = e;
    }
    out.wrap = wrap;
    return out;
  }

  // ---------------- 图片：按场景懒挂载 + 解码等待 ----------------
  const pending = [];
  function setSrc(im, src) {
    if (im.getAttribute('src') === src) return;
    if (!src) {
      im.removeAttribute('src');
      return;
    }
    im.src = src;
    pending.push(im.decode().catch(() => {}));
  }
  function lazyImg(src, cls, parent) {
    const im = el('img', cls, parent);
    im.dataset.src = src;
    im.alt = '';
    return im;
  }
  const shot = (name) => `shots/${name}.webp`;
  const asset = (name) => `../public/assets/${name}`;

  // ---------------- Ken Burns：让原图的归一化区域 rect 完整落进 frame ----------------
  const FULL = { x: 0, y: 0, w: 1, h: 1 };
  const mixRect = (a, b, p) => ({
    x: lerp(a.x, b.x, p),
    y: lerp(a.y, b.y, p),
    w: lerp(a.w, b.w, p),
    h: lerp(a.h, b.h, p),
  });
  function kb(im, fw, fh, rect) {
    const iw = im.naturalWidth;
    const ih = im.naturalHeight;
    if (!iw) return null;
    const s = Math.max(Math.min(fw / (rect.w * iw), fh / (rect.h * ih)), fw / iw, fh / ih);
    const cx = (rect.x + rect.w / 2) * iw * s;
    const cy = (rect.y + rect.h / 2) * ih * s;
    const tx = clamp(fw / 2 - cx, fw - iw * s, 0);
    const ty = clamp(fh / 2 - cy, fh - ih * s, 0);
    // 用布局尺寸缩放（而非 transform scale）：Skia 高质量重采样，截图里的界面小字更清楚
    im.style.width = iw * s + 'px';
    im.style.height = ih * s + 'px';
    im.style.transform = `translate(${tx}px, ${ty}px)`;
    return { s, tx, ty };
  }

  /** 竖版里横向截图的通用承托：同图高斯模糊铺底 + 原图整宽居中 */
  function blurFill(parent, src) {
    const b = lazyImg(src, 'cover', parent);
    css(b, { filter: 'blur(42px) brightness(0.42) saturate(1.1)', transform: 'scale(1.2)' });
    return b;
  }

  const scenes = [];
  function scene(def) {
    scenes.push(def);
    return def;
  }

  // =====================================================================
  // 1 · 冷开场：书桌 + 打字机
  // =====================================================================
  scene((() => {
    const c = S.open;
    const root = el('div', 'scene dusk');
    const bg = lazyImg(asset('bg-desk.jpg'), 'cover', root);
    css(bg, { filter: 'brightness(0.34) saturate(0.85) blur(1.5px)' });
    el('div', 'scrim', root).style.background =
      'radial-gradient(closest-side, transparent 30%, rgba(12,6,2,0.65))';
    const wrap = el('div', 'abs', root);
    css(wrap, { left: '0', right: '0', top: P(400, 800) + 'px', textAlign: 'center' });
    const rows = c.lines.map(() => {
      const r = el('div', '', wrap);
      css(r, {
        fontSize: P(58, 60) + 'px',
        color: 'var(--cream)',
        letterSpacing: '0.06em',
        height: P(100, 104) + 'px',
        whiteSpace: 'pre',
      });
      return r;
    });
    const step = c.typeMs / 1000;
    return {
      a: c.start,
      b: c.end,
      root,
      imgs: [bg],
      update(t) {
        root.style.opacity = Math.min(prog(t, 0, 0.6), 1 - prog(t, c.end - 0.3, c.end + 0.2));
        bg.style.transform = `scale(${lerp(1.1, 1.02, eOut(prog(t, 0, c.end)))})`;
        c.lines.forEach((ln, i) => {
          const chars = [...ln.text];
          const n = t < ln.at ? 0 : Math.min(chars.length, Math.floor((t - ln.at) / step) + 1);
          const next = c.lines[i + 1];
          const typing = t >= ln.at && n < chars.length;
          const holding = n === chars.length && (!next || t < next.at);
          const caretOn = typing || (holding && Math.floor(t * 2.2) % 2 === 0);
          // 未打出的字用透明占位：整行宽度不变，打字时不左右跳
          rows[i].innerHTML = '';
          el('span', '', rows[i], chars.slice(0, n).join(''));
          el('span', 'caret', rows[i], '▍').style.opacity = caretOn ? 1 : 0;
          el('span', '', rows[i], chars.slice(n).join('')).style.color = 'transparent';
        });
      },
    };
  })());

  // =====================================================================
  // 2 · 撕开录取通知书（实机逐帧）
  // =====================================================================
  scene((() => {
    const c = S.envelope;
    const root = el('div', 'scene');
    root.style.background = '#26170F';
    const SZ = 1080;
    const holder = el('div', 'abs', root);
    box(holder, (W - SZ) / 2, (H - SZ) / 2, SZ, SZ);
    const mask = 'radial-gradient(closest-side, #000 82%, transparent 100%)';
    css(holder, { webkitMaskImage: mask, maskImage: mask, transformOrigin: '50% 41%' });
    const frame = el('img', 'cover', holder);
    const frameB = el('img', 'cover', holder);
    const fin = lazyImg(shot('env/final'), 'cover', holder);
    // 鼠标指针：跟着实机滑块走（滑块中心 = 视口 x 498 + 284·p，y 594；截图裁切自视口 x 240 起的 800 见方）
    const cursor = el('div', 'abs', holder);
    cursor.innerHTML =
      '<svg width="40" height="48" viewBox="0 0 20 24"><path d="M2 1 L2 19 L6.5 15 L9.5 22 L12.5 20.8 L9.6 14 L16 14 Z" fill="#FFFBF0" stroke="#26180F" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    css(cursor, { width: '40px', height: '48px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.45))' });
    const flash = el('div', 'scrim', root);
    flash.style.background = 'var(--paper)';
    const N = 48;
    const PMAX = 0.955;
    const k = SZ / 800;
    return {
      a: c.start,
      b: c.end,
      root,
      imgs: [fin],
      update(t) {
        root.style.opacity = prog(t, c.start - 0.25, c.start + 0.2);
        const dp = eSine(prog(t, c.dragFrom, c.dragTo));
        const fi = dp * N;
        const i0 = Math.floor(fi);
        const i1 = Math.min(N, i0 + 1);
        setSrc(frame, shot('env/f' + String(i0).padStart(3, '0')));
        setSrc(frameB, shot('env/f' + String(i1).padStart(3, '0')));
        frameB.style.opacity = fi - i0;
        fin.style.opacity = prog(t, c.dragTo + 0.05, c.dragTo + 0.35);
        // 指针：从右下滑入 → 按住拖动 → 松手淡出
        const pr = dp * PMAX;
        const kx = (258 + 284 * pr) * k;
        const ky = 594 * k;
        const glide = eOut(prog(t, c.start + 0.05, c.dragFrom - 0.05));
        const cx = lerp(kx + 260, kx, glide);
        const cy = lerp(ky + 220, ky, glide);
        const pressed = t > c.dragFrom - 0.08 && t < c.dragTo;
        cursor.style.left = cx - 4 + 'px';
        cursor.style.top = cy - 2 + 'px';
        cursor.style.opacity = Math.min(glide * 1.4, 1 - prog(t, c.dragTo, c.dragTo + 0.25));
        cursor.style.transform = `scale(${pressed ? 0.9 : 1})`;
        // 信纸推近，再化进标题页的纸面
        holder.style.transform = `scale(${lerp(1, 1.22, eIn(prog(t, c.dragTo + 0.35, c.end)))})`;
        flash.style.opacity = prog(t, c.end - 0.55, c.end);
      },
    };
  })());

  // =====================================================================
  // 3 · 片名
  // =====================================================================
  scene((() => {
    const c = S.title;
    const root = el('div', 'scene paper');
    const wrap = el('div', 'abs', root);
    css(wrap, { left: '0', right: '0', top: P(300, 700) + 'px', textAlign: 'center' });
    const nameRow = el('div', '', wrap);
    css(nameRow, { position: 'relative', display: 'inline-block' });
    const name = el('div', '', nameRow, c.name);
    css(name, {
      fontSize: P(156, 124) + 'px',
      fontWeight: 700,
      letterSpacing: '0.2em',
      paddingLeft: '0.2em',
      color: 'var(--ink)',
      lineHeight: 1.15,
    });
    const seal = el('div', 'seal', nameRow, c.seal);
    const SEAL = P(92, 80);
    css(seal, {
      width: SEAL + 'px',
      height: SEAL + 'px',
      fontSize: SEAL * 0.46 + 'px',
      right: -SEAL * 0.95 + 'px',
      top: -SEAL * 0.45 + 'px',
    });
    const rule = el('div', '', wrap);
    css(rule, { height: '2px', background: 'var(--accent)', opacity: 0.55, margin: P('34px', '30px') + ' auto 0' });
    const tag = el('div', '', wrap, c.tagline);
    css(tag, { fontSize: P(56, 52) + 'px', marginTop: P(36, 34) + 'px', color: 'var(--ink)', letterSpacing: '0.06em' });
    const sub = el('div', '', wrap, c.sub);
    css(sub, { fontSize: P(27, 27) + 'px', marginTop: P(30, 34) + 'px', color: 'var(--ink-soft)', letterSpacing: '0.16em' });
    return {
      a: c.start,
      b: c.end,
      root,
      imgs: [],
      update(t) {
        root.style.opacity = Math.min(prog(t, c.start - 0.05, c.start + 0.15), 1 - prog(t, c.end - 0.3, c.end + 0.2));
        const a = appear(t, c.start + 0.15, 0.8);
        name.style.opacity = a;
        name.style.letterSpacing = lerp(0.3, 0.2, a) + 'em';
        name.style.transform = `translateY(${(1 - a) * 14}px)`;
        const st = prog(t, c.start + 0.75, c.start + 1.0);
        seal.style.opacity = st;
        seal.style.transform = `rotate(-10deg) scale(${lerp(1.7, 1, eOut(st))})`;
        rule.style.width = eOut(prog(t, c.start + 0.9, c.start + 1.5)) * 220 + 'px';
        fadeUp(tag, appear(t, c.start + 1.2, 0.7));
        fadeUp(sub, appear(t, c.start + 2.0, 0.7));
        wrap.style.transform = `scale(${lerp(1, 1.025, prog(t, c.start, c.end))})`;
      },
    };
  })());

  // =====================================================================
  // 4 · 学长系统绑定
  // =====================================================================
  scene((() => {
    const c = S.senpai;
    const root = el('div', 'scene dusk ondark');
    const imgs = [];
    let fw;
    let fh;
    let fx;
    let fy;
    if (PORTRAIT) {
      imgs.push(blurFill(root, shot('senpai')));
      fw = 1080;
      fh = Math.round(1080 / 1.7);
      fx = 0;
      fy = 700;
    } else {
      fw = W;
      fh = H;
      fx = 0;
      fy = 0;
    }
    const fr = el('div', 'abs', root);
    box(fr, fx, fy, fw, fh);
    fr.style.overflow = 'hidden';
    const im = lazyImg(shot('senpai'), 'kb', fr);
    imgs.push(im);
    const glow = el('div', 'scrim', fr);
    glow.style.background = 'radial-gradient(60% 70% at 72% 45%, rgba(255,190,120,0.55), transparent 70%)';
    if (!PORTRAIT) {
      el('div', 'scrim', root).style.background =
        'linear-gradient(90deg, rgba(18,9,3,0.78) 0%, rgba(18,9,3,0.45) 34%, rgba(18,9,3,0) 58%)';
    }
    const tb = textBlock(root, P(120, 70), P(150, 230), P(760, 940), P('left', 'center'), [
      ['kicker', 'kicker', c.kicker, 26],
      ['head', 'head', c.head, P(70, 68), { marginTop: '24px' }],
      ['sub', 'sub', c.sub, P(30, 30), { marginTop: '26px' }],
    ]);
    return {
      a: c.start,
      b: c.end,
      root,
      imgs,
      update(t) {
        root.style.opacity = windowOp(t, c.start, c.end);
        const p = eSine(prog(t, c.start, c.end));
        kb(im, fw, fh, mixRect(FULL, { x: 0.22, y: 0.04, w: 0.78, h: 0.9 }, p));
        // 「叮——」：绑定成功的一下暖光
        const d = prog(t, c.start + 0.1, c.start + 0.9);
        glow.style.opacity = Math.sin(Math.PI * d) * 0.5;
        fadeUp(tb.kicker, appear(t, c.start + 0.45));
        fadeUp(tb.head, appear(t, c.start + 0.75));
        fadeUp(tb.sub, appear(t, c.start + 1.35));
      },
    };
  })());

  // =====================================================================
  // 5 · 建档（序章）：卡片一张张落进档案堆
  // =====================================================================
  scene((() => {
    const c = S.profile;
    const root = el('div', 'scene paper');
    const tb = textBlock(root, P(130, 60), P(170, 190), P(700, 960), P('left', 'center'), [
      ['kicker', 'kicker', c.kicker, 26],
      ['head', 'head', c.head, P(78, 74), { marginTop: '20px' }],
    ]);
    // 牌堆区域
    const PX = P(1300, 540);
    const PY = P(560, 900);
    const BW = P(820, 860);
    const BH = P(720, 700);
    const ROT = [-3, 2.6, -1.6, 1.9];
    const OFF = [[-34, 12], [26, -16], [-12, 22], [16, -6]];
    const cards = c.cards.map((cd, i) => {
      const pr = el('div', 'print', root);
      const im = lazyImg(shot(cd.shot), '', pr);
      return { pr, im, i };
    });
    // 文案区
    const info = el('div', 'abs', root);
    box(info, P(130, 60), P(520, 1340), P(640, 960));
    info.style.textAlign = P('left', 'center');
    const rows = c.cards.map((cd, i) => {
      const g = el('div', 'abs', info);
      css(g, { left: '0', right: '0', top: '0' });
      const idx = el('div', '', g, `${pad2(i + 1)} / ${pad2(c.cards.length)}`);
      css(idx, { fontSize: '26px', color: 'var(--accent)', letterSpacing: '0.18em' });
      const lb = el('div', 'head', g, cd.label);
      css(lb, { fontSize: P(48, 50) + 'px', marginTop: '14px', color: 'var(--ink)' });
      const ln = el('div', 'sub', g, cd.line);
      css(ln, { fontSize: P(32, 32) + 'px', marginTop: '16px' });
      return g;
    });
    const T = (i) => c.cardsAt + i * c.cardDur;
    return {
      a: c.start,
      b: c.end,
      root,
      imgs: cards.map((x) => x.im),
      update(t) {
        root.style.opacity = windowOp(t, c.start, c.end);
        fadeUp(tb.kicker, appear(t, c.start + 0.2));
        fadeUp(tb.head, appear(t, c.start + 0.45));
        cards.forEach(({ pr, im, i }) => {
          const iw = im.naturalWidth || 1000;
          const ih = im.naturalHeight || 1000;
          const s = Math.min((BW - 24) / iw, (BH - 24) / ih);
          const w = iw * s + 24;
          const h = ih * s + 24;
          const a = prog(t, T(i) - 0.15, T(i) + 0.45);
          const e = eOut(a);
          const [ox, oy] = OFF[i];
          const x = PX - w / 2 + lerp(P(260, 120), ox, e);
          const y = PY - h / 2 + lerp(P(560, 760), oy, e);
          box(pr, x, y, w, h);
          pr.style.opacity = a > 0 ? 1 : 0;
          pr.style.transform = `rotate(${lerp(9, ROT[i], e)}deg)`;
          const covered = c.cards.findIndex((_, j) => j > i && t > T(j) + 0.2) >= 0;
          pr.style.filter = covered ? 'brightness(0.97)' : 'none';
        });
        rows.forEach((g, i) => {
          const inA = appear(t, T(i) + 0.05, 0.45);
          const outA = i < rows.length - 1 ? prog(t, T(i + 1) - 0.1, T(i + 1) + 0.2) : 0;
          g.style.opacity = inA * (1 - outA);
          g.style.transform = `translateY(${(1 - inA) * 18 - outA * 14}px)`;
        });
      },
    };
  })());

  // =====================================================================
  // 6 · Home 宿舍 hub + 行动点，接校园地图
  // =====================================================================
  scene((() => {
    const c = S.home;
    const root = el('div', 'scene dusk ondark');
    const imgs = [];
    const fw = W;
    const fh = P(H, Math.round(1080 / 1.6));
    const fy = P(0, 640);
    const layers = ['home', 'map'].map((name) => {
      const g = el('div', 'abs', root);
      css(g, { inset: '0' });
      if (PORTRAIT) imgs.push(blurFill(g, shot(name)));
      const fr = el('div', 'abs', g);
      box(fr, 0, fy, fw, fh);
      fr.style.overflow = 'hidden';
      const im = lazyImg(shot(name), 'kb', fr);
      imgs.push(im);
      return { g, fr, im };
    });
    // 行动点三颗圆点（实测：x 0.2553 / 0.2678 / 0.2803，y 0.0278，直径 ≈ 0.0078 宽）
    const DOTS = [0.2553, 0.2678, 0.2803];
    const rings = DOTS.map(() => {
      const r = el('div', 'abs', layers[0].fr);
      css(r, { borderRadius: '50%', boxShadow: '0 0 0 3px rgba(255,179,92,0.95), 0 0 26px 8px rgba(255,166,77,0.65)' });
      return r;
    });
    if (!PORTRAIT) {
      el('div', 'scrim', root).style.background =
        'linear-gradient(0deg, rgba(18,9,3,0.82) 0%, rgba(18,9,3,0.35) 30%, rgba(18,9,3,0) 50%)';
    }
    const capY = P(800, 250);
    const capX = P(120, 60);
    const capW = P(1400, 960);
    const align = P('left', 'center');
    const capA = textBlock(root, capX, capY, capW, align, [
      ['head', 'head', c.head, P(66, 66)],
      ['sub', 'sub', c.sub, P(32, 32), { marginTop: '14px' }],
    ]);
    const capB = textBlock(root, capX, capY, capW, align, [
      ['head', 'head', c.mapHead, P(66, 60)],
      ['sub', 'sub', c.mapSub, P(32, 32), { marginTop: '14px' }],
    ]);
    const HUD = { x: 0.1, y: 0, w: 0.48, h: 0.3 };
    const WIDE = { x: 0, y: 0, w: 1, h: P(0.9, 1) };
    return {
      a: c.start,
      b: c.end,
      root,
      imgs,
      update(t) {
        root.style.opacity = windowOp(t, c.start, c.end);
        // 宿舍：先全景，推近 HUD 看行动点亮起，再拉回
        const zin = eInOut(prog(t, c.start + 0.5, c.dotsAt[0] - 0.1));
        const zout = eInOut(prog(t, c.dotsAt[2] + 0.7, c.mapAt + 0.2));
        const r = mixRect(mixRect(WIDE, HUD, zin), WIDE, zout);
        const m = kb(layers[0].im, fw, fh, r);
        if (m) {
          const iw = layers[0].im.naturalWidth;
          const ih = layers[0].im.naturalHeight;
          rings.forEach((ring, i) => {
            const d = 0.0105 * iw * m.s;
            box(ring, DOTS[i] * iw * m.s + m.tx - d / 2, 0.0278 * ih * m.s + m.ty - d / 2, d, d);
            const on = prog(t, c.dotsAt[i], c.dotsAt[i] + 0.18);
            ring.style.opacity = on * (1 - prog(t, c.dotsAt[2] + 0.9, c.mapAt));
            ring.style.transform = `scale(${lerp(1.8, 1, eOut(on))})`;
          });
        }
        const mapA = prog(t, c.mapAt - 0.2, c.mapAt + 0.3);
        layers[1].g.style.opacity = mapA;
        kb(layers[1].im, fw, fh, mixRect(FULL, { x: 0.08, y: 0.04, w: 0.62, h: 0.62 }, eSine(prog(t, c.mapAt - 0.2, c.end + 0.2))));
        const aA = appear(t, c.start + 0.35) * (1 - prog(t, c.mapAt - 0.25, c.mapAt));
        fadeUp(capA.head, aA);
        fadeUp(capA.sub, appear(t, c.start + 0.75) * (1 - prog(t, c.mapAt - 0.25, c.mapAt)));
        fadeUp(capB.head, appear(t, c.mapAt + 0.15));
        fadeUp(capB.sub, appear(t, c.mapAt + 0.5));
      },
    };
  })());

  // =====================================================================
  // 7 · AI 教学关蒙太奇
  // =====================================================================
  // 每关截图与推镜区域（归一化坐标，按截图实测）；文案在 trailer.json
  const BEAT_SHOTS = {
    cs: [{ src: 'cs', from: { x: 0.02, y: 0.02, w: 0.96, h: 0.96 }, to: { x: 0.3, y: 0.09, w: 0.6, h: 0.62 } }],
    poster: [{ src: 'poster-chat', from: { x: 0.08, y: 0.08, w: 0.88, h: 0.8 }, to: { x: 0.32, y: 0.15, w: 0.64, h: 0.62 } }],
    ppt: [{ src: 'ppt', from: { x: 0.02, y: 0.04, w: 0.92, h: 0.92 }, to: { x: 0.05, y: 0.08, w: 0.68, h: 0.56 } }],
    coding: [
      { src: 'coding-f12', from: { x: 0.1, y: 0.05, w: 0.9, h: 0.6 }, to: { x: 0.22, y: 0.08, w: 0.7, h: 0.46 }, until: 0.48 },
      { src: 'coding-site', from: { x: 0.12, y: 0.06, w: 0.76, h: 0.74 }, to: { x: 0.18, y: 0.1, w: 0.62, h: 0.58 } },
    ],
    examiner: [{ src: 'examiner', from: { x: 0.08, y: 0.04, w: 0.84, h: 0.92 }, to: { x: 0.18, y: 0.2, w: 0.66, h: 0.5 } }],
    dachuang: [{ src: 'dachuang', from: { x: 0.12, y: 0.06, w: 0.84, h: 0.86 }, to: { x: 0.3, y: 0.1, w: 0.6, h: 0.44 } }],
    thesis: [{ src: 'thesis', from: { x: 0.08, y: 0.06, w: 0.84, h: 0.86 }, to: { x: 0.3, y: 0.18, w: 0.56, h: 0.6 } }],
  };
  const POSTERS = [asset('poster-acg-v1.jpg'), asset('poster-acg-v2.jpg'), asset('poster-acg-final.jpg')];
  scene((() => {
    const c = S.ai;
    const root = el('div', 'scene dusk ondark');
    const imgs = [];
    const head = textBlock(root, P(0, 60), P(380, 760), P(W, 960), 'center', [
      ['kicker', 'kicker', c.kicker, 26],
      ['head', 'head', c.head, P(82, 76), { marginTop: '26px' }],
    ]);
    const t0 = c.start + c.headDur;
    const bd = (c.end - t0) / c.beats.length;
    const fw = P(1090, 1000);
    const fh = Math.round(fw / 1.6);
    const fx = P(740, 40);
    const fy = P(200, 760);
    const beats = c.beats.map((b, k) => {
      const g = el('div', 'abs', root);
      css(g, { inset: '0' });
      const fr = el('div', 'frame', g);
      box(fr, fx, fy, fw, fh);
      const shots = BEAT_SHOTS[b.shot].map((sd) => {
        const im = lazyImg(shot(sd.src), 'kb', fr);
        imgs.push(im);
        return { ...sd, im };
      });
      let prints = [];
      if (b.labels) {
        prints = POSTERS.map((src, i) => {
          const pr = el('div', 'print', g);
          const im = lazyImg(src, '', pr);
          imgs.push(im);
          el('div', 'tag', pr, b.labels[i]);
          return pr;
        });
      }
      const info = el('div', 'abs', g);
      box(info, P(100, 60), P(290, 200), P(620, 960));
      info.style.textAlign = P('left', 'center');
      const cnt = el('div', '', info, `${pad2(k + 1)} / ${pad2(c.beats.length)}`);
      css(cnt, { fontSize: '24px', color: 'var(--ember)', letterSpacing: '0.2em', opacity: 0.85 });
      const lvl = el('div', '', info, b.level);
      css(lvl, { fontSize: P(30, 30) + 'px', color: 'var(--cream-soft)', letterSpacing: '0.1em', marginTop: '20px' });
      const chipRow = el('div', '', info);
      chipRow.style.marginTop = '22px';
      const chip = el('div', 'chip', chipRow, `${c.unlockPrefix} · ${b.ability}`);
      chip.style.fontSize = P('28px', '28px');
      const line = el('div', 'head', info, b.line);
      css(line, { fontSize: P(40, 46) + 'px', marginTop: P('34px', '30px'), lineHeight: 1.5 });
      return { g, fr, shots, prints, cnt, lvl, chip, line, T: t0 + k * bd };
    });
    return {
      a: c.start,
      b: c.end,
      root,
      imgs,
      update(t) {
        root.style.opacity = windowOp(t, c.start, c.end);
        const hOut = 1 - prog(t, t0 - 0.3, t0);
        fadeUp(head.kicker, appear(t, c.start + 0.1) * hOut);
        fadeUp(head.head, appear(t, c.start + 0.3) * hOut);
        beats.forEach((B, k) => {
          const p = prog(t, B.T, B.T + bd);
          const vis = Math.min(prog(t, B.T - 0.12, B.T + 0.16), 1 - prog(t, B.T + bd - 0.12, B.T + bd + 0.16));
          B.g.style.opacity = vis;
          if (vis <= 0) return;
          B.fr.style.transform = `translateY(${(1 - eOut(prog(t, B.T - 0.12, B.T + 0.4))) * 26}px)`;
          B.shots.forEach((sd, i) => {
            const startP = i === 0 ? 0 : B.shots[i - 1].until;
            const endP = sd.until ?? 1;
            const local = prog(p, startP, endP);
            const op = i === 0 ? 1 : prog(p, startP - 0.04, startP + 0.06);
            sd.im.style.opacity = op;
            kb(sd.im, fw, fh, mixRect(sd.from, sd.to, eSine(local)));
          });
          // 海报关：初稿 → 改风格 → 终稿，三张实图依次落在窗口右下
          B.prints.forEach((pr, i) => {
            const at = B.T + 0.35 + i * 0.42;
            const a = eOut(prog(t, at, at + 0.4));
            const pw = P(200, 190);
            const ph = Math.round(pw * 4 / 3);
            const baseX = P(fx + fw - 3 * (pw - 26) - 40, fx + fw - 3 * (pw - 30) - 50);
            const x = baseX + i * (pw - P(26, 30));
            const y = fy + fh - ph + P(40, 60);
            box(pr, x, y + (1 - a) * 120, pw, ph);
            pr.style.opacity = a > 0 ? 1 : 0;
            pr.style.transform = `rotate(${[-6, 2, 7][i]}deg) scale(${lerp(0.9, 1, a)})`;
            pr.style.zIndex = 10 + i;
          });
          fadeUp(B.cnt, appear(t, B.T, 0.4), 10);
          fadeUp(B.lvl, appear(t, B.T + 0.05, 0.4), 12);
          const cp = prog(t, B.T + 0.45, B.T + 0.75);
          B.chip.style.opacity = cp;
          B.chip.style.transform = `scale(${lerp(0.86, 1, eBack(cp))})`;
          fadeUp(B.line, appear(t, B.T + 0.2, 0.5));
        });
      },
    };
  })());

  // =====================================================================
  // 8 · 文件夹：里面掉落的东西是真的
  // =====================================================================
  const DROPS = [
    { src: asset('poster-acg-final.jpg'), w: 300, h: 400 },
    { src: asset('covers/cover-ppt-deck.webp'), w: 360, h: 240 },
    { src: asset('covers/cover-homepage-v1.webp'), w: 360, h: 240 },
    { src: asset('covers/cover-resume-doc.webp'), w: 330, h: 220 },
    { src: asset('covers/cover-dachuang-report.webp'), w: 330, h: 220 },
    { src: asset('covers/cover-gig-board.webp'), w: 330, h: 220 },
    { src: asset('covers/cover-thesis-doc.webp'), w: 330, h: 220 },
    { src: asset('covers/cover-doc-course-rules.webp'), w: 330, h: 220 },
  ];
  // 落点：相对牌堆中心的偏移与角度
  const LAND = P(
    [[-250, -210, -7], [130, -250, 5], [300, -40, 8], [-330, 70, -4], [40, 30, -2], [-120, 250, 6], [260, 220, -5], [-10, -60, 3]],
    [[-250, -250, -7], [170, -290, 5], [240, -20, 8], [-250, 60, -4], [40, 40, -2], [-170, 300, 6], [210, 280, -5], [-10, -80, 3]],
  );
  scene((() => {
    const c = S.folder;
    const root = el('div', 'scene paper');
    const imgs = [];
    const CX = P(1290, 540);
    const CY = P(560, 1080);
    const drops = DROPS.map((d) => {
      const pr = el('div', 'print', root);
      pr.style.padding = '10px';
      const im = lazyImg(d.src, '', pr);
      imgs.push(im);
      return { pr, ...d };
    });
    const textX = P(130, 60);
    const textW = P(640, 960);
    const align = P('left', 'center');
    const tA = textBlock(root, textX, P(300, 210), textW, align, [
      ['head', 'head', c.head, P(74, 74)],
      ['sub', 'sub', c.sub, P(32, 32), { marginTop: '30px' }],
    ]);
    const tB = textBlock(root, textX, P(300, 210), P(570, 960), align, [
      ['head', 'head', c.promptHead + '\n' + c.promptSub, P(48, 58)],
    ]);
    // 文件夹实机截图（提示词库）
    const fw = P(1090, 1000);
    const fh = Math.round(fw / 1.6);
    const fr = el('div', 'frame', root);
    box(fr, P(740, 40), P(220, 700), fw, fh);
    const fim = lazyImg(shot('folder'), 'kb', fr);
    imgs.push(fim);
    const phaseB = c.start + 4.2;
    return {
      a: c.start,
      b: c.end,
      root,
      imgs,
      update(t) {
        root.style.opacity = windowOp(t, c.start, c.end);
        const outA = eInOut(prog(t, phaseB - 0.3, phaseB + 0.3));
        drops.forEach((d, i) => {
          const at = c.start + 0.25 + i * 0.17;
          const a = prog(t, at, at + 0.55);
          const e = eBack(a);
          const [ox, oy, rot] = LAND[i];
          const sc = P(1, 0.92);
          const w = d.w * sc;
          const h = d.h * sc;
          box(d.pr, CX + ox - w / 2, CY + oy - h / 2 + lerp(-H * 0.9, 0, e) - outA * 60, w, h);
          d.pr.style.opacity = (a > 0 ? 1 : 0) * (1 - outA);
          d.pr.style.transform = `rotate(${lerp(rot * 3, rot, eOut(a))}deg)`;
          d.pr.style.zIndex = i;
        });
        const aOut = 1 - prog(t, phaseB - 0.3, phaseB);
        fadeUp(tA.head, appear(t, c.start + 0.5, 0.7) * aOut);
        fadeUp(tA.sub, appear(t, c.start + 1.3, 0.7) * aOut);
        fadeUp(tB.head, appear(t, phaseB + 0.1, 0.6));
        const fa = eOut(prog(t, phaseB - 0.05, phaseB + 0.5));
        fr.style.opacity = fa;
        fr.style.transform = `translateY(${(1 - fa) * 60}px)`;
        kb(fim, fw, fh, mixRect({ x: 0.02, y: 0.08, w: 0.96, h: 0.92 }, { x: 0.03, y: 0.62, w: 0.94, h: 0.38 }, eInOut(prog(t, phaseB + 0.6, c.end - 0.2))));
      },
    };
  })());

  // =====================================================================
  // 9 · 四年时间轴 → 毕业档案与身份卡
  // =====================================================================
  const YEAR_BG = ['bg-desk.jpg', 'bg-classroom.jpg', 'bg-club.jpg', 'bg-lab.jpg', 'bg-studio.jpg', 'bg-office.jpg', 'bg-meeting.jpg', 'bg-campus.jpg', 'bg-grad.jpg'];
  scene((() => {
    const c = S.years;
    const root = el('div', 'scene dusk ondark');
    const bgs = YEAR_BG.map((f) => {
      const im = lazyImg(asset(f), 'cover', root);
      css(im, { filter: 'brightness(0.42) saturate(0.95)' });
      return im;
    });
    el('div', 'scrim', root).style.background = P(
      'linear-gradient(90deg, rgba(18,9,3,0.7) 0%, rgba(18,9,3,0.2) 60%)',
      'linear-gradient(180deg, rgba(18,9,3,0.65) 0%, rgba(18,9,3,0.15) 40%, rgba(18,9,3,0.55) 100%)',
    );
    const head = textBlock(root, P(140, 60), P(300, 230), P(900, 960), P('left', 'center'), [
      ['head', 'head', c.head, P(80, 72)],
      ['sub', 'sub', c.sub, P(32, 32), { marginTop: '24px' }],
    ]);
    // 时间轴
    const n = c.timeline.length;
    const LX0 = P(200, 80);
    const LX1 = P(1720, 1000);
    const LY = P(900, 1560);
    const tl = el('div', 'abs', root);
    css(tl, { inset: '0' });
    const base = el('div', 'abs', tl);
    box(base, LX0, LY - 1, LX1 - LX0, 2);
    base.style.background = 'rgba(246,231,204,0.25)';
    const fill = el('div', 'abs', tl);
    box(fill, LX0, LY - 1, 0, 2);
    fill.style.background = 'var(--ember)';
    const nodes = c.timeline.map((label, i) => {
      const x = lerp(LX0, LX1, i / (n - 1));
      const dot = el('div', 'node', tl);
      css(dot, { left: x + 'px', top: LY + 'px', width: '18px', height: '18px' });
      const lb = el('div', 'node-label', tl, label);
      css(lb, { left: x + 'px', top: LY + 26 + 'px', fontSize: P(26, 23) + 'px' });
      return { dot, lb };
    });
    // 毕业档案长卡（实机截图，向上滚到身份卡）
    const cw = P(600, 900);
    const ch = P(900, 1040);
    const cfr = el('div', 'frame light', root);
    box(cfr, P(1170, 90), P(90, 640), cw, ch);
    const card = lazyImg(shot('grad-card'), 'kb', cfr);
    const at = (i) => c.nodesAt + i * c.nodeStep;
    return {
      a: c.start,
      b: c.end,
      root,
      imgs: [...bgs, card],
      update(t) {
        root.style.opacity = windowOp(t, c.start, c.end);
        let cur = -1;
        for (let i = 0; i < n; i++) if (t >= at(i)) cur = i;
        bgs.forEach((im, i) => {
          const a = i === 0 ? 1 : prog(t, at(i) - 0.08, at(i) + 0.2);
          im.style.opacity = a;
          im.style.transform = `scale(${lerp(1.08, 1.0, prog(t, at(i), at(i) + 1.6))})`;
        });
        nodes.forEach(({ dot, lb }, i) => {
          const on = prog(t, at(i), at(i) + 0.15);
          css(dot, {
            background: on > 0 ? 'var(--ember)' : 'var(--dusk)',
            border: `2px solid ${on > 0 ? 'var(--ember)' : 'rgba(246,231,204,0.45)'}`,
            boxShadow: i === cur ? '0 0 0 6px rgba(255,179,92,0.25), 0 0 22px rgba(255,166,77,0.7)' : 'none',
            transform: `translate(-50%,-50%) scale(${lerp(1.5, 1, eOut(on))})`,
          });
          lb.style.color = on > 0 ? 'var(--cream)' : 'rgba(203,179,148,0.6)';
          lb.style.fontWeight = i === cur ? 700 : 400;
        });
        const fp = clamp((cur + clamp((t - at(Math.max(cur, 0))) / c.nodeStep)) / (n - 1));
        fill.style.width = (cur < 0 ? 0 : eOut(fp) * (LX1 - LX0)) + 'px';
        tl.style.opacity = 1 - prog(t, c.cardAt - 0.2, c.cardAt + 0.2);
        fadeUp(head.head, appear(t, c.start + 0.5, 0.7));
        fadeUp(head.sub, appear(t, c.cardAt + 0.1, 0.6));
        const ca = eOut(prog(t, c.cardAt - 0.1, c.cardAt + 0.5));
        cfr.style.opacity = ca;
        cfr.style.transform = `translateY(${(1 - ca) * 80}px)`;
        if (card.naturalWidth) {
          const s = cw / card.naturalWidth;
          const maxOff = card.naturalHeight * s - ch;
          const off = lerp(maxOff * 0.38, maxOff, eInOut(prog(t, c.cardAt + 0.3, c.end - 0.15)));
          css(card, { width: cw + 'px', height: card.naturalHeight * s + 'px', transform: `translateY(${-off}px)` });
        }
      },
    };
  })());

  // =====================================================================
  // 10 · 收尾：学长的最后一句 → 片名定版
  // =====================================================================
  scene((() => {
    const c = S.end;
    const root = el('div', 'scene paper');
    const lineWrap = el('div', 'abs', root);
    css(lineWrap, { left: '0', right: '0', top: P(330, 700) + 'px', textAlign: 'center' });
    const av = lazyImg(asset('avatar-senpai.jpg'), '', lineWrap);
    css(av, { width: '96px', height: '96px', borderRadius: '50%', display: 'block', margin: '0 auto', boxShadow: '0 0 0 4px var(--accent-soft)' });
    const spk = el('div', '', lineWrap, c.speaker);
    css(spk, { display: 'inline-block', marginTop: '18px', padding: '4px 16px', borderRadius: '999px', background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: '24px', letterSpacing: '0.2em' });
    const line = el('div', 'head', lineWrap, c.line);
    css(line, { fontSize: P(54, 52) + 'px', marginTop: '30px', fontWeight: 400, lineHeight: 1.6 });
    // 定版
    const lock = el('div', 'abs', root);
    css(lock, { left: '0', right: '0', top: P(290, 740) + 'px', textAlign: 'center' });
    const nameRow = el('div', '', lock);
    css(nameRow, { position: 'relative', display: 'inline-block' });
    const name = el('div', '', nameRow, c.name);
    css(name, { fontSize: P(140, 118) + 'px', fontWeight: 700, letterSpacing: '0.2em', paddingLeft: '0.2em', lineHeight: 1.15 });
    const SEAL = P(84, 74);
    const seal = el('div', 'seal', nameRow, S.title.seal);
    css(seal, { width: SEAL + 'px', height: SEAL + 'px', fontSize: SEAL * 0.46 + 'px', right: -SEAL * 0.95 + 'px', top: -SEAL * 0.45 + 'px' });
    const tag = el('div', '', lock, c.tagline);
    css(tag, { fontSize: P(52, 48) + 'px', marginTop: '34px', letterSpacing: '0.06em' });
    const urlRow = el('div', '', lock);
    urlRow.style.marginTop = P('56px', '64px');
    const url = el('div', 'pill', urlRow, CFG.meta.url);
    url.style.fontSize = P('38px', '40px');
    const cta = el('div', '', lock, c.cta);
    css(cta, { fontSize: '26px', marginTop: '26px', color: 'var(--ink-soft)', letterSpacing: '0.3em' });
    return {
      a: c.start,
      b: c.end,
      root,
      imgs: [av],
      update(t) {
        root.style.opacity = prog(t, c.start - 0.2, c.start + 0.2);
        const L = c.lockupAt;
        const lineA = appear(t, c.start + 0.1, 0.6) * (1 - prog(t, L - 0.45, L - 0.1));
        lineWrap.style.opacity = lineA;
        lineWrap.style.transform = `translateY(${(1 - appear(t, c.start + 0.1, 0.6)) * 16}px)`;
        const a = appear(t, L, 0.8);
        name.style.opacity = a;
        name.style.letterSpacing = lerp(0.3, 0.2, a) + 'em';
        const st = prog(t, L + 0.05, L + 0.3);
        seal.style.opacity = st;
        seal.style.transform = `rotate(-10deg) scale(${lerp(1.7, 1, eOut(st))})`;
        fadeUp(tag, appear(t, L + 0.5, 0.6));
        fadeUp(urlRow, appear(t, L + 0.9, 0.6));
        fadeUp(cta, appear(t, L + 1.2, 0.6));
      },
    };
  })());

  // 片尾压黑
  const black = el('div', 'scrim');
  css(black, { background: '#000', zIndex: 100, opacity: 0 });
  const END = CFG.meta.duration;

  // ---------------- 字体预热：把全部文案按两种字重各排一遍，等切片字体下载完 ----------------
  const allText = new Set();
  (function walk(o) {
    if (typeof o === 'string') allText.add(o);
    else if (o && typeof o === 'object') Object.values(o).forEach(walk);
  })(CFG);
  const sample = [...allText].join('') + '0123456789/·—▍';
  const warm = document.getElementById('fontwarm');
  warm.innerHTML = `<span style="font-family:'LXGW WenKai Lite';font-weight:400">${sample}</span><span style="font-family:'LXGW WenKai Lite';font-weight:700">${sample}</span>`;
  await Promise.all([
    document.fonts.load(`400 40px "LXGW WenKai Lite"`, sample),
    document.fonts.load(`700 40px "LXGW WenKai Lite"`, sample),
  ]);
  await document.fonts.ready;

  // ---------------- seek ----------------
  function render(t) {
    for (const sc of scenes) {
      const live = t >= sc.a - 1.0 && t <= sc.b + 1.0;
      sc.root.style.display = live ? '' : 'none';
      sc.imgs.forEach((im) => setSrc(im, live ? im.dataset.src : null));
      if (live) sc.update(t);
    }
    black.style.opacity = prog(t, END - 0.7, END);
  }
  window.__seek = async (t) => {
    render(t);
    if (pending.length) {
      await Promise.all(pending.splice(0));
      render(t); // 新图解码后才有 naturalWidth，再排一遍
    }
    return true;
  };
  window.__duration = END;
  window.__fps = CFG.meta.fps;
  window.__size = [W, H];
  await window.__seek(parseFloat(params.get('t') || '0'));
  window.__ready = true;
})();
