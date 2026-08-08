#!/usr/bin/env python3
"""人物插画 → 透明立绘 / 头像（抠像流水线）。

为什么需要它：生图工具产出的人物插画自带背景（学姐那张里是整间活动室），
直接贴到关卡场景图上就是"一张图里嵌了另一张图"。VN 立绘必须是透明抠像，
人物才能站进场景里。

用法（需要一次性装依赖，约 250MB，含 176MB 的 isnet-anime 模型）：
    python3 -m venv .mattenv
    .mattenv/bin/pip install "rembg[cpu]" pillow
    .mattenv/bin/python scripts/matte-sprites.py <原图目录>

原图目录里按下面的 SPRITES / AVATARS 表命名即可；产物直接写进 public/assets，
文件名与引擎约定一致（立绘 sprite-*.webp 带 alpha，头像 avatar-*.jpg 暖底圆章）。
另会在 <原图目录>/_check 下输出洋红棋盘格校验图，用于肉眼检查抠边残留。

模型选 isnet-anime：专门针对二次元角色训练，对发丝和半透明边缘明显好于通用 u2net。
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter
from rembg import new_session, remove

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "assets")

# 立绘：抠成透明 webp，按内容 bbox 裁紧，统一高度 900px
# （下缘不留边——立绘下半身一律被对话框压住）
SPRITES = [
    ("学长立绘.png", "sprite-senpai"),
    ("学姐（海报）.png", "sprite-xuejie"),
    ("导师.png", "sprite-prof"),
    ("面试官.png", "sprite-hr"),
]
# 头像：保持原取景，只把背景换成暖色渐变圆底（原图各自的书架/活动室背景与 UI 不搭）
AVATARS = [("学长头像.png", "avatar-senpai"), ("学姐头像.png", "avatar-xuejie")]

SPRITE_H = 900
AVATAR_SIZE = 256
INNER, OUTER = (250, 238, 214), (221, 197, 160)  # 呼应 parchment / cream 色板

MATTE_KW = dict(
    alpha_matting=True,
    alpha_matting_foreground_threshold=250,
    alpha_matting_background_threshold=15,
    alpha_matting_erode_size=8,
)


def cutout(session, path):
    """抠像 + 轻微羽化 alpha（消锯齿与残留背景色描边）。"""
    img = Image.open(path).convert("RGBA")
    cut = remove(img, session=session, **MATTE_KW)
    cut.putalpha(cut.getchannel("A").filter(ImageFilter.GaussianBlur(0.6)))
    return cut


def warm_disc(size):
    """暖色径向底：中心奶油、边缘略深。"""
    w, h = size
    bg = Image.new("RGB", size, OUTER)
    px = bg.load()
    cx, cy, r = w / 2, h / 2, (w**2 + h**2) ** 0.5 / 2
    for y in range(h):
        for x in range(w):
            d = min(1.0, (((x - cx) ** 2 + (y - cy) ** 2) ** 0.5) / r * 1.35)
            px[x, y] = tuple(round(INNER[i] + (OUTER[i] - INNER[i]) * d) for i in range(3))
    return bg.convert("RGBA")


def main(src_dir):
    check_dir = os.path.join(src_dir, "_check")
    os.makedirs(check_dir, exist_ok=True)
    session = new_session("isnet-anime")

    for name, stem in SPRITES:
        path = os.path.join(src_dir, name)
        if not os.path.exists(path):
            print(f"skip (missing): {name}")
            continue
        cut = cutout(session, path)
        box = cut.getbbox()
        if box:
            cut = cut.crop(box)
        w, h = cut.size
        cut = cut.resize((max(1, round(w * SPRITE_H / h)), SPRITE_H), Image.LANCZOS)
        out = os.path.join(OUT, stem + ".webp")
        cut.save(out, "WEBP", quality=88, method=6)
        print(f"{stem}.webp  {cut.size[0]}x{cut.size[1]}  {os.path.getsize(out)//1024}KB")

        chk = Image.new("RGBA", cut.size, (255, 0, 255, 255))
        chk.alpha_composite(cut)
        chk.convert("RGB").save(os.path.join(check_dir, stem + ".jpg"), quality=88)

    for name, stem in AVATARS:
        path = os.path.join(src_dir, name)
        if not os.path.exists(path):
            print(f"skip (missing): {name}")
            continue
        cut = cutout(session, path)
        bg = warm_disc(cut.size)
        bg.alpha_composite(cut)
        img = bg.convert("RGB").resize((AVATAR_SIZE, AVATAR_SIZE), Image.LANCZOS)
        out = os.path.join(OUT, stem + ".jpg")
        img.save(out, "JPEG", quality=90)
        print(f"{stem}.jpg  {AVATAR_SIZE}x{AVATAR_SIZE}  {os.path.getsize(out)//1024}KB")

        mask = Image.new("L", (AVATAR_SIZE, AVATAR_SIZE), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, AVATAR_SIZE - 1, AVATAR_SIZE - 1), fill=255)
        prev = Image.new("RGB", (AVATAR_SIZE, AVATAR_SIZE), (38, 24, 15))
        prev.paste(img, (0, 0), mask)
        prev.save(os.path.join(check_dir, stem + ".jpg"), quality=92)

    print("校验图：", check_dir)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(f"用法：{sys.argv[0]} <原图目录>")
    main(sys.argv[1])
