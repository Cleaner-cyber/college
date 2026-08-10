#!/usr/bin/env python3
"""作品封面占位 SVG 生成器（铁律 5：真实封面未就位前用占位图，
文件名 cover-<archiveItemId>.svg，后续同名替换即可，不改代码）。

风格：暖纸底 + 单个低饱和色块 + 白描图形 + 细线纹样，克制不花哨。
"""
import os
import pathlib

OUT = pathlib.Path(__file__).resolve().parent.parent / 'public/assets/covers'
W, H = 480, 360

# 每个作品：色（低饱和暖调家族）、图形（24×24 stroke path 组）、纹样
ITEMS = {
    'doc-course-rules': {
        'hue': '#A8552F',  # 赭红
        'glyph': [
            'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z',
            'M9 8h6', 'M9 12h6', 'M9 16h4',
        ],
        'motif': 'lines',
    },
    'doc-summer-plan': {
        'hue': '#8A6D3B',  # 陈皮黄褐
        'glyph': [
            'M5 5h14a1.5 1.5 0 0 1 1.5 1.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6.5A1.5 1.5 0 0 1 5 5z',
            'M3.5 9.5h17', 'M8 3v4', 'M16 3v4', 'M8 13.5h2', 'M14 13.5h2', 'M8 17h2',
        ],
        'motif': 'grid',
    },
    'doc-ppt-outline': {
        'hue': '#7A6A54',  # 灰橄榄
        'glyph': [
            'M4 5h16v10H4z', 'M12 15v4', 'M8.5 19h7', 'M7.5 8h6', 'M7.5 11h4',
        ],
        'motif': 'stack',
    },
    'ppt-deck': {
        'hue': '#5E6B7A',  # 蓝灰
        'glyph': [
            'M4 4.5h16v10.5H4z', 'M12 15v4.5', 'M8 19.5h8', 'M9 8l3.5 2L9 12z',
        ],
        'motif': 'stack',
    },
    'dachuang-report': {
        'hue': '#6E5470',  # 藕紫
        'glyph': [
            'M5 20V9', 'M10 20V4', 'M15 20v-8', 'M20 20V7', 'M3 20h18',
        ],
        'motif': 'rays',
    },
    'gig-board': {
        'hue': '#B0713A',  # 姜黄
        'glyph': [
            'M4 4h16v12H4z', 'M4 8h16', 'M8 16v3', 'M16 16v3', 'M7 6h.01', 'M10 6h4',
        ],
        'motif': 'lines',
    },
    'resume-doc': {
        'hue': '#5F7161',  # 苔绿
        'glyph': [
            'M6 3h9l4 4v14H6z', 'M15 3v4h4', 'M9 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
            'M8 17c.6-1.8 2-2.5 3-2.5s2.4.7 3 2.5',
        ],
        'motif': 'lines',
    },
    'thesis-doc': {
        'hue': '#4F4438',  # 深烟褐
        'glyph': [
            'M12 4L3 8.5l9 4.5 9-4.5z', 'M7 11v4.5c0 1 2.2 2.5 5 2.5s5-1.5 5-2.5V11',
            'M21 8.5V14',
        ],
        'motif': 'rays',
    },
    'homepage-v1': {
        'hue': '#54666E',  # 青瓷灰
        'glyph': [
            'M4 5h16v14H4z', 'M4 9h16', 'M6.5 7h.01', 'M9 7h.01',
            'M7 13h4', 'M7 16h6', 'M14.5 12.5l2.5 2-2.5 2',
        ],
        'motif': 'grid',
    },
}


def motif_svg(kind: str, hue: str) -> str:
    if kind == 'grid':
        ls = [f'<line x1="{x}" y1="24" x2="{x}" y2="{H-24}" />' for x in range(120, W - 60, 56)]
        ls += [f'<line x1="96" y1="{y}" x2="{W-24}" y2="{y}" />' for y in range(72, H - 40, 56)]
        return f'<g stroke="{hue}" stroke-opacity="0.10" stroke-width="1">{"".join(ls)}</g>'
    if kind == 'stack':
        rs = [
            f'<rect x="{300+i*22}" y="{56+i*30}" width="132" height="88" rx="8" '
            f'fill="none" stroke="{hue}" stroke-opacity="{0.16-i*0.04}" stroke-width="1.5"/>'
            for i in range(3)
        ]
        return ''.join(rs)
    if kind == 'rays':
        ls = [
            f'<line x1="{W-40}" y1="{H-32}" x2="{W-40-140}" y2="{H-32-r}" />'
            for r in (40, 80, 120, 160)
        ]
        return f'<g stroke="{hue}" stroke-opacity="0.12" stroke-width="1.5">{"".join(ls)}</g>'
    # lines
    ls = [f'<line x1="288" y1="{y}" x2="{W-40}" y2="{y}" />' for y in range(88, H - 56, 34)]
    return f'<g stroke="{hue}" stroke-opacity="0.14" stroke-width="2" stroke-linecap="round">{"".join(ls)}</g>'


def cover(item_id: str, cfg: dict) -> str:
    hue = cfg['hue']
    paths = ''.join(
        f'<path d="{d}" fill="none" stroke="#FFFBF0" stroke-width="1.7" '
        f'stroke-linecap="round" stroke-linejoin="round"/>'
        for d in cfg['glyph']
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <rect width="{W}" height="{H}" fill="#F7EDD9"/>
  <rect width="{W}" height="{H}" fill="{hue}" fill-opacity="0.06"/>
  {motif_svg(cfg['motif'], hue)}
  <rect x="-70" y="-70" width="300" height="300" rx="72" transform="rotate(12 80 80)" fill="{hue}" fill-opacity="0.92"/>
  <g transform="translate(36 44) scale(4.2)">{paths}</g>
  <rect x="0" y="{H-10}" width="{W}" height="10" fill="{hue}" fill-opacity="0.85"/>
  <text x="{W-14}" y="{H-22}" text-anchor="end" font-family="monospace" font-size="9"
        fill="{hue}" fill-opacity="0.45">cover-{item_id}</text>
</svg>
'''


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for item_id, cfg in ITEMS.items():
        (OUT / f'cover-{item_id}.svg').write_text(cover(item_id, cfg), encoding='utf-8')
        print('写出', f'cover-{item_id}.svg')


if __name__ == '__main__':
    main()
