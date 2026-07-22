#!/usr/bin/env python3
"""行动板全图生成器：读取 content/sim/actions.json / tags.json，
重新生成 docs/09_行动板全图.md 的「五、全部行动明细」小节（第五节之前的设计说明保持手写不动）。
用法：python3 scripts/gen-action-map.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / 'docs' / '09_行动板全图.md'

actions = json.loads((ROOT / 'content/sim/actions.json').read_text(encoding='utf-8'))
tags = {t['id']: t['name'] for t in json.loads((ROOT / 'content/sim/tags.json').read_text(encoding='utf-8'))}

AXES = {'academic': '学术', 'portfolio': '作品', 'expression': '表达', 'cash': '现金', 'energy': '精力'}
MAJORS = {'cs': '计算机类', 'eng': '工科', 'sci': '理科', 'med': '医学', 'biz': '商科',
          'hum': '人文', 'design': '设计', 'edu': '教育', 'law': '法学'}
ABIL = {'doc-feeding': 'AI 读长文档', 'image-gen': 'AI 生图', 'structured-gen': 'AI 做 PPT',
        'ai-coding': 'AI 编程', 'examiner': 'AI 口语陪练', 'note-taking': 'AI 记笔记', 'role-play': 'AI 模拟面试',
        'lit-review': 'AI 读论文', 'data-analysis': 'AI 分析数据', 'multimodal': 'AI 做短视频'}
SEM = {1: '大一上', 2: '大一下', 3: '大二上', 4: '大二下', 5: '大三上', 6: '大三下', 7: '大四'}
GROUPS = {'study': '学习拓展', 'research': '科研与竞赛', 'practice': '社会实践', 'work': '搞钱', 'life': '生活'}
LABELS = {a['id']: a['label'] for a in actions}


def deltas_str(d):
    return ' '.join(f"{AXES[k]}{'+' if v > 0 else ''}{v}" for k, v in d.items()) if d else '—'


def cond_str(c):
    if not c:
        return ''
    parts = []
    if 'semesterMin' in c:
        parts.append(f"{SEM[c['semesterMin']]}起")
    if 'semesterMax' in c:
        parts.append(f"限{SEM[c['semesterMax']]}前")
    if c.get('minAxes'):
        parts.append('、'.join(f"{AXES[k]}≥{v}" for k, v in c['minAxes'].items()))
    if c.get('maxAxes'):
        parts.append('、'.join(f"{AXES[k]}≤{v}" for k, v in c['maxAxes'].items()))
    if c.get('abilities'):
        parts.append('会「' + '+'.join(ABIL.get(a, a) for a in c['abilities']) + '」')
    if c.get('minActions'):
        parts.append('、'.join(f"{LABELS.get(k, k)}×{v}" for k, v in c['minActions'].items()))
    if c.get('minTags'):
        parts.append('、'.join(f"{tags.get(k, k)}×{v}" for k, v in c['minTags'].items()))
    if c.get('traits'):
        parts.append('特质:' + '/'.join(c['traits']))
    return ' + '.join(parts)


def outcome_str(o):
    s = deltas_str(o.get('deltas'))
    extra = []
    if o.get('tags'):
        extra.append('人设:' + '、'.join(f"{tags.get(k, k)}+{v}" for k, v in o['tags'].items()))
    if o.get('archive'):
        extra.append(f"📁{o['archive']['title']}")
    if o.get('next'):
        extra.append(f"→连锁「{o['next']}」")
    return s + ('｜' + '｜'.join(extra) if extra else '')


def branch_rows(a):
    rows = []
    n = len(a['branches'])
    for i, b in enumerate(a['branches']):
        cond = cond_str(b.get('when'))
        cond = cond if cond else ('（默认兜底）' if (i == n - 1 and n > 1) else '（无条件）')
        if b.get('check'):
            ck = b['check']
            rows.append(
                f"{cond} → 检定{AXES[ck['axis']]}(难度{ck['dc']})："
                f"成 {outcome_str(b['success'])}｜败 {outcome_str(b['fail'])}")
        else:
            rows.append(f"{cond} → {outcome_str(b['result'])}")
    return rows


out = [f"\n## 五、全部 {len(actions)} 项行动明细（自动生成）\n"]
for g in ['study', 'research', 'practice', 'work', 'life']:
    items = [a for a in actions if a.get('group', 'life') == g]
    out.append(f"\n### {GROUPS[g]}（{len(items)} 项）\n")
    for a in items:
        gate = []
        if a.get('majors'):
            gate.append('专业：' + '/'.join(MAJORS.get(m, m) for m in a['majors']))
        if a.get('semesters'):
            gate.append('仅限：' + '、'.join(a['semesters']))
        rq = cond_str(a.get('requires'))
        if rq:
            gate.append('前置：' + rq)
        if a.get('once'):
            gate.append('全程一次')
        gate_s = '｜'.join(gate) if gate else '全专业全学期'
        out.append(f"**{a.get('icon', '')} {a['label']}**（{a['cost']}点）· {gate_s}")
        out.append(f"> {a['desc']}")
        for r in branch_rows(a):
            out.append(f"> - {r}")
        out.append('')

doc = DOC.read_text(encoding='utf-8')
doc = re.split(r'\n## 五、全部 \d+ 项行动明细（自动生成）\n', doc)[0].rstrip() + '\n' + '\n'.join(out)
DOC.write_text(doc, encoding='utf-8')
print(f'regenerated: {DOC} ({len(actions)} actions)')
