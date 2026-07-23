#!/usr/bin/env python3
"""专业目录生成器（docs/10 知识库 → 游戏内容）：
- content/majors/catalog.json：全量可选专业（id=专业名，含 门类/专业类/游戏大类），供序章分级浏览与搜索；
  首条保留 generic（自定义专业）兜底；aliases 带旧版 37 个专业 id（旧档兼容）。
- public/assets/majors/<专业名>.json：单专业详情（速览卡字段 + 全部小节全文），序章按需 fetch（同源静态资源）。
用法：python3 scripts/gen-majors.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KB = ROOT / 'knowledge' / 'majors'
OUT_DETAIL = ROOT / 'public' / 'assets' / 'majors'
OUT_CATALOG = ROOT / 'content' / 'majors' / 'catalog.json'

# 门类 → 游戏 9 大类（docs/10 第三节；计算机相关按关键词升 cs）
GROUP_CAT = {
    '01哲学类': 'hum', '02经济学类': 'biz', '03法学类': 'law', '04教育学类': 'edu',
    '05文学类': 'hum', '06历史学类': 'hum', '07理学类': 'sci', '08工学类': 'eng',
    '09农学类': 'sci', '010医学类': 'med', '011管理学类': 'biz', '012艺术类': 'design',
    '014交叉学科': 'eng',
}
CS_KEYWORDS = ('计算机', '软件', '人工智能', '智能科学', '数据科学', '网络空间', '信息安全', '网络安全',
               '机器人', '区块链', '大数据', '物联网', '数字媒体技术', '脑机', '具身')
GROUP_ORDER = ['01哲学类', '02经济学类', '03法学类', '04教育学类', '05文学类', '06历史学类',
               '07理学类', '08工学类', '09农学类', '010医学类', '011管理学类', '012艺术类', '014交叉学科']
GROUP_NAME = {g: re.sub(r'^0?\d+', '', g).removesuffix('类') if g != '014交叉学科' else '交叉学科' for g in GROUP_ORDER}

# 旧版 37 专业 id → 专业名（旧档兼容，getMajor 按 alias 兜底）
LEGACY = {oid: info['name'] for oid, info in json.loads((KB / 'mapping.json').read_text(encoding='utf-8')).items()}


def clean(text: str) -> str:
    """去 AUTO_NAV / obsidian 双链 / 分隔线，保留 ### 子标题与段落。"""
    text = re.split(r'<!--\s*AUTO_NAV', text)[0]
    text = re.split(r'\n## (?:AUTO_NAV|相关阅读|下一步阅读)', text)[0]
    text = re.sub(r'\[\[([^\]|]*\|)?([^\]]+)\]\]', r'\2', text)
    text = re.sub(r'\n-{3,}\n', '\n\n', text)
    return text.strip()


def parse(md: str):
    """→ (title, intro, [(sec_title, sec_body)])"""
    md = clean(md)
    m = re.match(r'#\s+(.+)\n', md)
    title = m.group(1).strip() if m else ''
    body = md[m.end():] if m else md
    parts = re.split(r'\n##\s+', '\n' + body)
    intro = parts[0].strip()
    secs = []
    for p in parts[1:]:
        lines = p.split('\n', 1)
        st = lines[0].strip()
        sb = (lines[1] if len(lines) > 1 else '').strip()
        if sb and 'AUTO_NAV' not in st:
            secs.append((st, sb))
    return title, intro, secs


def cut(text: str, limit: int = 150) -> str:
    """截到句号边界的短文案。"""
    text = re.sub(r'\s+', ' ', text).strip()
    if len(text) <= limit:
        return text
    head = text[:limit]
    for stop in ('。', '！', '？', '；'):
        i = head.rfind(stop)
        if i >= limit // 3:
            return head[: i + 1]
    return head + '…'


def first_para(body: str) -> str:
    for p in re.split(r'\n{2,}', body):
        p = p.strip()
        if p and not p.startswith('#') and not p.startswith('-') and not p.startswith('|'):
            return p
    return ''


def find_sec(secs, *keys):
    for st, sb in secs:
        if any(k in st for k in keys):
            return sb
    return ''


def build_card(intro: str, secs) -> dict:
    card = {}
    if intro:
        card['intro'] = cut(first_para(intro))
    pos = find_sec(secs, '定位')
    if pos:
        one = next((p.strip() for p in re.split(r'\n{2,}', pos)
                    if p.strip().startswith(('一句话', '总之', '说白了'))), '')
        card['positioning'] = cut(one or first_para(pos))
    fit = find_sec(secs, '适合')
    if fit:
        card['fit'] = cut(first_para(fit))
        unfit = next((p.strip() for p in re.split(r'\n{2,}', fit) if p.strip().startswith('不适合')), '')
        if unfit:
            card['unfit'] = cut(unfit)
    pit = find_sec(secs, '避坑', '坑点')
    if pit:
        h = re.search(r'###\s*(.+)', pit)
        card['pit'] = cut((h.group(1).strip() + '：' if h else '') + first_para(pit))
    path = find_sec(secs, '升学', '就业', '出路', '去向')
    if path:
        card['paths'] = cut(first_para(path))
    return card


def walk():
    """→ [(group, klass, name, path)]，跳过索引/概览/脚本杂物，全库按名去重（首见优先）。"""
    seen = set()
    out = []
    for g in GROUP_ORDER:
        gdir = KB / g
        if not gdir.is_dir():
            continue
        subdirs = sorted([d for d in gdir.iterdir() if d.is_dir()])
        units = [(d.name, d) for d in subdirs] or [(GROUP_NAME[g], gdir)]
        for klass, kdir in units:
            for f in sorted(kdir.glob('*.md')):
                name = f.stem
                if name.startswith('0000') or name == klass or name == klass.removesuffix('类') + '类':
                    continue
                if name in seen:
                    continue
                seen.add(name)
                out.append((g, klass, name, f))
    return out


def main():
    OUT_DETAIL.mkdir(parents=True, exist_ok=True)
    legacy_by_name = {}
    for oid, nm in LEGACY.items():
        legacy_by_name.setdefault(nm, []).append(oid)

    catalog = [{
        'id': 'generic', 'name': '通用 / 没找到我的专业', 'aliases': [],
        'group': '', 'klass': '', 'category': 'any',
    }]
    n_detail = 0
    for g, klass, name, f in walk():
        cat = GROUP_CAT[g]
        if any(k in name for k in CS_KEYWORDS):
            cat = 'cs'
        if '公安' in klass:
            cat = 'law'
        if '体育' in klass:
            cat = 'edu'
        title, intro, secs = parse(f.read_text(encoding='utf-8'))
        entry = {
            'id': name, 'name': name, 'aliases': legacy_by_name.get(name, []),
            'group': GROUP_NAME[g], 'klass': klass, 'category': cat,
        }
        catalog.append(entry)
        detail = {
            'id': name, 'name': name,
            'card': build_card(intro, secs),
            'sections': [{'title': st, 'body': sb} for st, sb in secs],
        }
        (OUT_DETAIL / f'{name}.json').write_text(
            json.dumps(detail, ensure_ascii=False), encoding='utf-8')
        n_detail += 1

    OUT_CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=1), encoding='utf-8')
    size = sum(p.stat().st_size for p in OUT_DETAIL.glob('*.json'))
    print(f'catalog: {len(catalog)} majors ({OUT_CATALOG.stat().st_size // 1024}KB); '
          f'details: {n_detail} files ({size // 1024 // 1024}.{size // 1024 % 1024}MB)')


if __name__ == '__main__':
    main()
