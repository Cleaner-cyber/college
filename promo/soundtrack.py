#!/usr/bin/env python3
"""宣传片配乐 + 音效合成器（纯 numpy，零外部音频素材）。

读 promo/trailer.json 的时间轴，按同一份时间点生成：
- 配乐：80 BPM、C 大调，软钢琴 + 八音盒 + 弦垫，IV–V–iii–vi 循环，结尾落 I；
- 音效：打字声、撕信封、学长「叮——」、转场纸声、能力解锁提示音、时间轴逐格点亮。

用法：python3 promo/soundtrack.py [输出.wav]   （默认 promo/out/soundtrack.wav）
"""
import json
import sys
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
CFG = json.loads((ROOT / 'trailer.json').read_text(encoding='utf-8'))
S = CFG['scenes']
SR = 48000
DUR = CFG['meta']['duration'] + 1.5
N = int(DUR * SR)
BEAT = 60 / CFG['meta']['bpm']
BAR = BEAT * 4
rng = np.random.default_rng(7)

music = np.zeros((2, N))
sfx = np.zeros((2, N))


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, sig, t0, pan=0.0, gain=1.0):
    """把单声道信号按等功率声像放进立体声缓冲区。"""
    i0 = int(t0 * SR)
    if i0 >= N:
        return
    sig = sig[: N - i0] * gain
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i0:i0 + len(sig)] += sig * l
    buf[1, i0:i0 + len(sig)] += sig * r


def smooth(x, n):
    """滑动平均（简易低通）。"""
    if n <= 1:
        return x
    k = np.ones(n) / n
    return np.convolve(x, k, mode='same')


# ---------------- 乐器 ----------------

def piano(m, dur, vel=0.6):
    f = hz(m)
    length = dur + 1.6
    t = np.arange(int(length * SR)) / SR
    out = np.zeros_like(t)
    B = 0.00035
    for n in range(1, 9):
        fn = f * n * np.sqrt(1 + B * n * n)
        if fn > SR / 2.2:
            break
        amp = (1 / n ** 1.35) * (vel ** (0.4 * (n - 1)))
        decay = 0.9 + 0.55 * n + f / 900
        out += amp * np.sin(2 * np.pi * fn * t + rng.uniform(0, 6.28)) * np.exp(-t * decay)
    out *= np.minimum(1, t / 0.004)
    # 松键：dur 之后 0.35s 指数收尾
    rel = np.where(t > dur, np.exp(-(t - dur) / 0.35), 1.0)
    out *= rel
    # 琴槌噪声（极轻）
    ham = rng.standard_normal(int(0.012 * SR)) * np.exp(-np.arange(int(0.012 * SR)) / (0.002 * SR))
    out[: len(ham)] += smooth(ham, 6) * 0.05 * vel
    return out * vel


def musicbox(m, vel=0.5):
    f = hz(m)
    t = np.arange(int(2.4 * SR)) / SR
    out = (np.sin(2 * np.pi * f * t) * np.exp(-t * 2.6)
           + 0.35 * np.sin(2 * np.pi * f * 3.01 * t) * np.exp(-t * 7)
           + 0.12 * np.sin(2 * np.pi * f * 5.43 * t) * np.exp(-t * 12))
    out *= np.minimum(1, t / 0.002)
    return out * vel


def pad(notes, dur, vel=0.2, attack=1.2, release=1.8):
    length = dur + release
    t = np.arange(int(length * SR)) / SR
    out = np.zeros_like(t)
    for m in notes:
        f = hz(m)
        for det in (-0.0018, 0.0, 0.0021):
            ff = f * (1 + det)
            out += (np.sin(2 * np.pi * ff * t + rng.uniform(0, 6.28))
                    + 0.3 * np.sin(2 * np.pi * 2 * ff * t)
                    + 0.12 * np.sin(2 * np.pi * 3 * ff * t))
    env = np.minimum(1, t / attack) * np.where(t > dur, np.exp(-(t - dur) / (release / 3)), 1.0)
    trem = 1 + 0.06 * np.sin(2 * np.pi * 0.23 * t)
    return out * env * trem * vel / (len(notes) * 3)


def bell(f, vel=0.6, length=3.2):
    t = np.arange(int(length * SR)) / SR
    parts = [(1.0, 1.0, 1.4), (2.0, 0.42, 2.6), (2.76, 0.32, 3.4), (4.07, 0.16, 5.5), (5.4, 0.08, 7.5)]
    out = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in parts)
    out *= np.minimum(1, t / 0.0015)
    return out * vel


def noise_burst(length, lo, hi, env_fn):
    n = int(length * SR)
    x = rng.standard_normal(n)
    band = smooth(x, max(1, int(SR / hi))) - smooth(x, max(2, int(SR / lo)))
    t = np.arange(n) / SR
    return band * env_fn(t)


# ---------------- 和声与旋律 ----------------

CH = {
    'C': (36, [52, 55, 59, 62, 64]),
    'F': (41, [53, 57, 60, 64]),
    'G': (43, [55, 59, 62, 64]),
    'Em': (40, [52, 55, 59, 62]),
    'Am': (45, [52, 55, 60, 64]),
    'G7sus': (43, [53, 57, 60, 62]),
}
# 0-2 引子 → 3 标题落 I → IV–V–iii–vi 循环 → 22 属挂留 → 23 回到 I
PROG = ['F', 'G', 'G7sus', 'C'] + ['F', 'G', 'Em', 'Am'] * 4 + ['F', 'G', 'Em', 'Am', 'F', 'G', 'G7sus', 'C']

MOTIF_A = [(0, 76, 1.5), (1.5, 79, 0.5), (2, 81, 2)], [(0, 79, 1), (1, 74, 1), (2, 76, 2)], \
          [(0, 71, 1.5), (1.5, 74, 0.5), (2, 76, 1), (3, 79, 1)], [(0, 76, 4)]
MOTIF_B = [(0, 81, 1.5), (1.5, 79, 0.5), (2, 76, 1), (3, 79, 1)], [(0, 74, 1), (1, 76, 1), (2, 79, 2)], \
          [(0, 76, 1), (1, 74, 1), (2, 71, 2)], [(0, 72, 2), (2, 76, 2)]

intro_end = S['title']['start']
ai0, ai1 = S['ai']['start'], S['ai']['end']
folder0, years0, end0 = S['folder']['start'], S['years']['start'], S['end']['start']

for bar, name in enumerate(PROG):
    t0 = bar * BAR
    if t0 >= DUR:
        break
    bass, chord = CH[name]
    final = bar == len(PROG) - 1
    hold = BAR * (2.2 if final else 1.0)

    if t0 < intro_end:
        # 引子：弦垫 + 稀疏八音盒，随信封启封慢慢抬起
        lift = 0.5 + 0.5 * (bar / 3)
        place(music, pad(chord, BAR, vel=0.10 * lift), t0)
        for k, step in enumerate([0, 1.5, 2.5, 3.25] if bar else [1, 2.5]):
            m = chord[(k * 2 + bar) % len(chord)] + 24
            place(music, musicbox(m, 0.10 * lift), t0 + step * BEAT, pan=0.3 - 0.2 * k)
        continue

    in_ai = ai0 <= t0 < ai1
    in_folder = folder0 <= t0 < years0 - 0.01
    in_years = years0 - 1.6 <= t0 < end0

    place(music, pad(chord, hold, vel=0.12 if not in_folder else 0.16), t0)
    # 左手：根音 + 五度
    if not in_folder or bar == int(folder0 / BAR):
        place(music, piano(bass, hold if final else BEAT * 2.2, 0.40), t0, pan=-0.25)
        if not final:
            place(music, piano(bass + 7, BEAT * 1.6, 0.28), t0 + BEAT * 2, pan=-0.2)
        if in_ai:
            place(music, piano(bass + 12, BEAT * 0.8, 0.30), t0 + BEAT, pan=-0.2)
            place(music, piano(bass + 12, BEAT * 0.8, 0.30), t0 + BEAT * 3, pan=-0.2)
    # 右手：柱式和弦（标题与结尾）/ 八分分解（行进段）
    if bar == 3 or final:
        for i, m in enumerate(chord):
            place(music, piano(m, hold, 0.42), t0 + i * 0.012, pan=0.1 * i - 0.1)
    elif in_ai or in_years:
        pattern = [0, 2, 1, 3, 2, 1, 3, 2]
        for i, idx in enumerate(pattern):
            place(music, piano(chord[idx % len(chord)] + 12, BEAT * 0.6, 0.20 if in_ai else 0.17),
                  t0 + i * BEAT / 2, pan=0.25)
    elif not in_folder:
        for i, idx in enumerate([0, 1, 2, 3]):
            place(music, piano(chord[idx % len(chord)], BEAT * 1.8, 0.18), t0 + i * BEAT, pan=0.15)

    # 旋律：标题后一小节进入；目录段只留旋律，最后两小节做终止式
    rel = bar - 4
    if rel >= 0 and not final and name != 'G7sus':
        cycle = (rel // 4) % 2
        motif = (MOTIF_A, MOTIF_B)[cycle][rel % 4]
        for beat, m, d in motif:
            place(music, piano(m, d * BEAT, 0.5 if in_ai else 0.44), t0 + beat * BEAT, pan=0.2)
    if name == 'G7sus':
        for beat, m, d in [(0, 74, 2), (2, 79, 2)]:
            place(music, piano(m, d * BEAT, 0.44), t0 + beat * BEAT, pan=0.2)
    if final:
        place(music, piano(76, BAR * 1.8, 0.46), t0, pan=0.2)
        place(music, musicbox(88, 0.12), t0 + BEAT * 2, pan=0.4)

# ---------------- 音效 ----------------

# 打字声：与画面打字机同一节拍
op = S['open']
for line in op['lines']:
    for k, ch in enumerate(line['text']):
        if ch == ' ':
            continue
        t = line['at'] + k * op['typeMs'] / 1000
        click = noise_burst(0.03, 1500, 6000, lambda x: np.exp(-x / 0.004)) * 0.55
        click += bell(2200 + rng.uniform(-150, 150), 0.03, 0.03)
        place(sfx, click, t, pan=rng.uniform(-0.2, 0.2))

# 撕信封：拖动全程的纸纤维撕裂（密集碎裂 + 带通噪声），越撕越响
env = S['envelope']
tear_len = env['dragTo'] - env['dragFrom']
n = int(tear_len * SR)
tt = np.arange(n) / SR
crackle = np.zeros(n)
for _ in range(int(tear_len * 260)):
    i = rng.integers(0, n - 400)
    L = rng.integers(60, 400)
    crackle[i:i + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(0.3, 1)
body = noise_burst(tear_len, 600, 3800, lambda x: 0.35 + 0.65 * (x / tear_len))
tear = (smooth(crackle, 5) * 0.5 + body * 0.5) * np.minimum(1, tt / 0.15) * (0.6 + 0.4 * tt / tear_len)
place(sfx, tear, env['dragFrom'], pan=-0.1, gain=0.22)
# 信纸露出：八音盒上行
for k, m in enumerate([84, 88, 91, 96]):
    place(sfx, musicbox(m, 0.16), env['dragTo'] + 0.08 + k * 0.09, pan=-0.3 + 0.2 * k)

# 学长「叮——」
place(sfx, bell(hz(88), 0.38), S['senpai']['start'] + 0.15)
place(sfx, bell(hz(95), 0.18), S['senpai']['start'] + 0.27, pan=0.2)

# 转场纸声（轻）
for key in ['title', 'senpai', 'profile', 'home', 'ai', 'folder', 'years', 'end']:
    swish = noise_burst(0.5, 400, 3500, lambda x: np.sin(np.pi * np.clip(x / 0.5, 0, 1)) ** 2)
    place(sfx, swish, S[key]['start'] - 0.22, pan=0.0, gain=0.10)

# 建档卡片：每张一记纸片落桌
pf = S['profile']
for k in range(len(pf['cards'])):
    t = pf['cardsAt'] + k * pf['cardDur']
    thud = noise_burst(0.12, 150, 2500, lambda x: np.exp(-x / 0.025))
    place(sfx, thud, t + 0.05, pan=0.2, gain=0.22)

# 行动点逐个亮起
for k, t in enumerate(S['home']['dotsAt']):
    place(sfx, musicbox(84 + [0, 4, 7][k], 0.2), t, pan=-0.3)

# AI 关卡：每一拍的「解锁」提示音
ai = S['ai']
beat_dur = (ai['end'] - ai['start'] - ai['headDur']) / len(ai['beats'])
for k in range(len(ai['beats'])):
    t = ai['start'] + ai['headDur'] + k * beat_dur + 0.45
    place(sfx, musicbox(91, 0.13), t, pan=0.35)
    place(sfx, musicbox(96, 0.09), t + 0.07, pan=0.35)

# 时间轴：九格逐个点亮，八音盒上行音阶
yr = S['years']
scale = [72, 74, 76, 79, 81, 84, 86, 88, 91]
for k in range(len(yr['timeline'])):
    place(sfx, musicbox(scale[k], 0.15), yr['nodesAt'] + k * yr['nodeStep'], pan=-0.4 + 0.1 * k)
place(sfx, bell(hz(84), 0.16), yr['cardAt'], pan=0.1)

# ---------------- 混响与母带 ----------------

def reverb(x, seconds=2.6, mix=0.28):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    out = np.zeros_like(x)
    size = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
    for ch in range(2):
        ir = rng.standard_normal(n) * np.exp(-t / (seconds / 5.5))
        ir = smooth(ir, 5)
        ir[: int(0.012 * SR)] = 0
        ir /= np.sqrt(np.sum(ir ** 2))
        y = np.fft.irfft(np.fft.rfft(x[ch], size) * np.fft.rfft(ir, size), size)[: x.shape[1]]
        out[ch] = x[ch] * (1 - mix) + y * mix * 1.6
    return out


# 低频收一收：减去 ~120Hz 以下的一半能量，避免钢琴低音 + 混响发闷
for ch in range(2):
    music[ch] -= 0.5 * smooth(smooth(music[ch], 400), 400)
mix = reverb(music, 2.8, 0.30) * 0.9 + reverb(sfx, 1.4, 0.18)
# 首尾淡入淡出
fade_in = np.minimum(1, np.arange(N) / (0.3 * SR))
end_t = CFG['meta']['duration']
fade_out = np.clip((end_t + 1.2 - np.arange(N) / SR) / 2.4, 0, 1)
mix *= fade_in * fade_out
# 软限幅 + 归一
peak = np.max(np.abs(mix))
mix = np.tanh(mix / peak * 1.15) / np.tanh(1.15) * 0.89

out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'out' / 'soundtrack.wav'
out.parent.mkdir(parents=True, exist_ok=True)
pcm = (mix.T * 32767).astype(np.int16)
with wave.open(str(out), 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'wrote {out} ({DUR:.1f}s)')
