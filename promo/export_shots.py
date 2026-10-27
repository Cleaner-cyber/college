#!/usr/bin/env python3
"""把 capture.cjs 采到的原始截图（promo/.raw，1280×800 @2x = 2560×1600）裁切压缩成
宣传片用的 promo/shots/*.webp。裁切框是在 @2x 原图上实测的像素坐标。

用法：python3 promo/export_shots.py   （依赖 Pillow）
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
RAW = ROOT / '.raw'
OUT = ROOT / 'shots'

VN = (306, 202, 2254, 1348)  # VN 场景卡片（圆角框）在 @2x 截图里的位置

# 名字 → (裁切框 | None, 输出最大宽度)
SHOTS = {
    'senpai': (VN, 1948),
    'flag': ((306, 154, 2254, 1302), 1400),
    'major': ((740, 80, 1820, 1480), 1080),
    'path': ((740, 175, 1825, 1390), 1085),
    'traits': ((735, 170, 1820, 1395), 1085),
    'home': (None, 2560),  # 要推近 HUD，保留原分辨率
    'map': (None, 1920),
    'cs': (None, 1920),
    'poster-chat': (None, 1920),
    'ppt': (None, 1920),
    'coding-f12': (None, 1920),
    'coding-site': (None, 1920),
    'examiner': (None, 1920),
    'dachuang': (None, 1920),
    'thesis': (None, 1920),
    'folder': (None, 1920),
    'stats': (None, 1920),
    'grad-card': ((700, 0, 1860, None), 1160),  # 整页长截图，只取中间那张卡
}


def export(src: Path, dst: Path, crop, width, quality=84):
    im = Image.open(src).convert('RGB')
    if crop:
        x0, y0, x1, y1 = crop
        im = im.crop((x0, y0, x1, y1 if y1 is not None else im.height))
    if width and im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(dst, quality=quality, method=6)
    return im.size


def main():
    OUT.mkdir(exist_ok=True)
    for name, (crop, width) in SHOTS.items():
        src = RAW / 'named' / f'{name}.png'
        if not src.exists():
            print(f'  ! 缺 {src}')
            continue
        print(name, export(src, OUT / f'{name}.webp', crop, width))
    # 信封启封序列：取以信封为中心的 800×800（@2x 即 1600 见方），压到 1080 见方
    (OUT / 'env').mkdir(exist_ok=True)
    frames = sorted((RAW / 'env').glob('*.png'))
    for f in frames:
        im = Image.open(f).convert('RGB').crop((480, 0, 2080, 1600)).resize((1080, 1080), Image.LANCZOS)
        im.save(OUT / 'env' / f'{f.stem}.webp', quality=80, method=6)
    print('env frames', len(frames))


if __name__ == '__main__':
    main()
