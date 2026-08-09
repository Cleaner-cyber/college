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
    """摘要正文：跳过小标题/列表/表格，累积正文段直到够一段话的信息量。

    知识库里几乎每段都以一句引子开场（「这专业挑人。」「简单说几句。」），
    只取第一段会让 702 张专业卡里大半只剩这半句话——真正的内容在后面的段落。
    因此这里累积到 MIN_LEN 为止（再由 cut() 截到句号边界）。
    """
    MIN_LEN = 60
    picked: list[str] = []
    total = 0
    for p in re.split(r'\n{2,}', body):
        p = p.strip()
        if not p or p.startswith('#') or p.startswith('-') or p.startswith('|'):
            continue
        picked.append(p)
        total += len(p)
        if total >= MIN_LEN:
            break
    return ' '.join(picked)


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


# ── 四年课程表抽取（detail.courses 字段）─────────────────────────────
# 课程名判定：纯中文 2~12 字 + 以课程常见后缀结尾（白名单），再过黑名单（非课程词）。
COURSE_SUFFIXES = (
    '微积分', '数据库', '视听说', '学', '论', '史', '法', '语', '原理', '导论', '概论', '通论', '总论',
    '化学', '数学', '物理', '写作', '设计', '技术', '工程', '管理', '系统', '网络', '算法',
    '分析', '会计', '审计', '实验', '实务', '实践', '逻辑', '制图', '绘图', '基础', '代数', '统计',
    '金融', '营销', '电路', '理论', '方法', '学习', '构成', '乐理', '贸易', '翻译', '口译', '笔译',
    '测量', '选读', '概况', '交际', '测试', '交互',
)
# 完整名等于后缀本身（或仅靠短后缀撑起的泛词）默认拒绝，除非在 ALLOW_EXACT 里。
COURSE_ALLOW_EXACT = {
    '大学英语', '大学物理', '大学语文', '大学化学', '大学计算机基础', '数据结构',
    '微积分', '数据库', '电路', '素描', '色彩', '速写', '油画', '国画', '视唱练耳', '和声',
}
COURSE_EXACT_BLOCK = {
    '大学', '中学', '小学', '留学', '自学', '教学', '开学', '上学', '入学', '退学', '休学', '辍学',
    '治学', '求学', '办学', '好学', '博学', '数学', '化学', '文学', '哲学', '科学', '医学', '史学',
    '法学', '力学', '历史', '理论', '导论', '概论', '总论', '通论', '绪论', '算法', '语法', '句法',
    '想法', '做法', '说法', '看法', '办法', '用法', '玩法', '打法', '手法', '写法', '笔法', '兵法',
    '魔法', '佛法', '大法', '加法', '减法', '乘法', '除法', '取法', '效法', '疗法', '司法', '立法',
    '执法', '违法', '合法', '守法', '普法', '讨论', '争论', '评论', '结论', '定论', '推论', '立论',
    '舆论', '言论', '无论', '不论', '悖论', '外语', '术语', '双语', '母语', '口语', '成语', '谚语',
    '俗语', '俄语', '英语', '日语', '法语', '德语', '韩语', '汉语', '粤语', '案例分析', '数据分析',
    '时间管理', '情绪管理', '自我管理', '打基础', '零基础', '比基础', '理论与实践', '大量阅读',
    '常用方法',
}
# 口语缩写 → 正式课名
COURSE_ALIAS = {'高数': '高等数学', '线代': '线性代数', '高代': '高等代数', '大物': '大学物理'}
COURSE_SUBSTR_BLOCK = (
    '大一', '大二', '大三', '大四', '学期', '学年', '学分', '绩点', '学长', '学姐', '学校', '学院',
    '同学', '老师', '秋招', '春招', '招聘', '实习', '简历', '面试', '考研', '保研', '考公', '法考',
    '竞赛', '比赛', '大赛', '毕业', '证书', '四六级', '四级', '六级', '托福', '雅思', '这门', '那门',
    '几门', '这些', '那些', '板块', '模块', '专业', '方向', '能力', '思维', '建议', '要点', '攻略',
    '规划', '避坑', '坑点', '就业', '升学', '薪资', '日常', '安排', '办法', '方法论', '学习方法',
    '学习要点', '学习习惯', '门课', '个课', '课题', '经历', '基础课', '类课程',
)
_CJK_NAME = re.compile(r'[一-鿿]{2,12}\Z')
_YEAR_HEAD = re.compile(r'^\s*(?:#{2,4}\s*)?(?:\*\*)?\s*(?:模块[一二三四五\d]+[：:]\s*)?大([一二三四])')
_YEAR_TAIL = re.compile(r'大([一二三四])[上下]?学期是')
_YEAR_NUM = {'一': 1, '二': 2, '三': 3, '四': 4}
# 列举子句里粘连的前导/尾随废词
_LEAD_JUNK = re.compile(
    r'^(?:先把|把|将|当时|当年|后来|现在|首先|其次|然后|接着|最后|另外|同时|还有|还得|还要|以及|包括'
    r'|涵盖|主要有|主要|比如|例如|推荐|涉及|所谓|除了|开始|接触|知道|发现|觉得|认为|明白|理解|学好'
    r'|就是|都是|因为|所以|如果|但是|而且|并且|一套|一个|一些|几个|两个|三个|多个|大量|内容|我们'
    r'|你们|他们|这些|那些|有个|有些|会学到|会学|会讲|会接触|会系统|会用|介绍|参与|偶尔'
    r'|我|你|他|她|这|那|些|在|但)+')
_TAIL_JUNK = re.compile(r'(?:这门|那门|一门|要学|要上|要考|要深入学|来了|开课|很重要|最重要|等等|等|了|也|均)+$')
# 子句切分：标点 + 常见连接词（不含「和/与/、」，它们可能出现在课名内部或列举里）
_CLAUSE_SPLIT = re.compile(
    r'[，。；：！？…—“”‘’·\*]|——|等多种|等各种|等一系列|(?:主要)?是|包括|涵盖|除了|还有|以及|同时|先把|学好'
    r'|所谓|涉及|比如|例如')


def _valid_one(name):
    """单个候选（已规范化）→ 课程名 或 None。"""
    if not _CJK_NAME.match(name) or any(ch in name for ch in '的了在让被') or name.endswith('大学'):
        return None
    if name in COURSE_ALLOW_EXACT:
        return name
    if name in COURSE_EXACT_BLOCK or any(b in name for b in COURSE_SUBSTR_BLOCK):
        return None
    if any(name.endswith(s) and len(name) > len(s) for s in COURSE_SUFFIXES):
        return name
    return None


def _valid_courses(raw):
    """原始候选 → [课程名]（0/1/2 个：「A和B」两侧都像课名时拆开）。"""
    name = raw.strip('《》〈〉「」【】“”‘’"\'· 　：:，。—…（）()')
    name = _TAIL_JUNK.sub('', _LEAD_JUNK.sub('', name))
    if '是' in name:  # 「XX是核心课」整句被捕获时只留主语（课程名不含「是」）
        name = _TAIL_JUNK.sub('', name.split('是', 1)[0])
    name = COURSE_ALIAS.get(name, name)
    for sep in ('和', '与'):
        if sep in name:
            a, _, b = name.partition(sep)
            va, vb = _valid_one(a), _valid_one(b)
            if va and vb:
                return [va, vb]
    c = _valid_one(name)
    return [c] if c else []


def _enum_items(s):
    """从一行里的顿号列举抽课程名：子句内 ≥2 个像课程名的项才认。括号内容单独再扫一遍。"""
    out = []
    inner = [a or b for a, b in re.findall(r'（([^（）]*)）|\(([^()]*)\)', s)]
    outer = re.sub(r'（[^（）]*）|\([^)]*\)', '、', s)
    for seg in [outer] + inner:
        for clause in _CLAUSE_SPLIT.split(seg):
            parts = clause.split('、')
            if len(parts) < 2:
                continue
            valid = [c for p in parts for c in _valid_courses(p)]
            if len(valid) >= 2:
                out.extend(valid)
    return out


def _line_candidates(line):
    """一行文本 → [(tier, 课程名)]；tier1=强信号（书名号/加粗/小标题/冒号引导/顿号列举），tier2=弱信号。"""
    out = []
    h3 = re.match(r'#{3,4}\s*(.+)', line)
    if h3:
        out.extend((1, c) for c in _valid_courses(h3.group(1)))
        return out
    for m in re.findall(r'《([^《》]{2,20})》', line) + re.findall(r'\*\*([^*]{2,20})\*\*', line):
        out.extend((1, c) for c in _valid_courses(m))
    s = line.replace('**', '').strip()
    leads = [c for m in re.finditer(r'(?:^[-*\d.、\s]*|[。；！？]\s*)([一-鿿]{2,12})[：:]', s)
             for c in _valid_courses(m.group(1))]
    if leads:
        # 「课名：解释…」——冒号后面是这门课的描述，别再从描述里挖子话题
        out.extend((1, c) for c in leads)
        return out
    out.extend((1, c) for c in _enum_items(s))
    for m in re.finditer(r'([一-鿿]{2,12})课(?!程)', s):
        out.extend((2, c) for c in _valid_courses(m.group(1)))
    for m in re.finditer(r'(?:^|[。；！？])\s*([一-鿿]{2,12}?)(?:则讲|讲|是|教你|介绍)', s):
        out.extend((2, c) for c in _valid_courses(m.group(1)))
    return out


def _intro_secs(intro):
    """「模块体」文档（无 H2，路线图/课程藏在 intro 的 ### 模块N 下）→ 拆成伪小节。"""
    if '### ' not in intro:
        return []
    chunks = re.split(r'\n(?=###\s*模块)', '\n' + intro)
    if len(chunks) > 1:
        out = []
        for ch in chunks[1:]:
            lines = ch.split('\n', 1)
            title = re.sub(r'^###\s*(?:模块[一二三四五六七八九十\d]+[：:])?\s*', '', lines[0]).strip()
            out.append((title, lines[1] if len(lines) > 1 else ''))
        return out
    m = re.search(r'\n###\s*大一', intro)
    if m:  # 无模块标题、直接 ### 大一 分年的变体
        return [('四年路线图', intro[m.start():])]
    return []


def extract_courses(intro, secs):
    """从「四年路线图/大学四年规划」按年抽课程；「核心课程」抽到未归年的按文中顺序补进各年空位。
    防御式：任何异常返回 None（调用方跳过 courses 字段）。"""
    try:
        secs = _intro_secs(intro) + list(secs)
        years = {1: [], 2: [], 3: [], 4: []}
        pool = []
        seen = set()
        year = None
        in_flow = False
        for st, sb in secs:
            is_road = '路线图' in st or ('四年' in st and '能力' not in st)
            is_course = '课程' in st or '学什么' in st  # B 模板「专业到底学什么」也是课程小节
            if is_road:
                in_flow, year = True, None
            elif in_flow and ('课程安排' in st or '课余' in st):
                pass  # 路线图行文里穿插的「核心课程安排/课余安排」小节，沿用当前年级
            elif is_course:
                in_flow, year = False, None
            else:
                in_flow, year = False, None
                continue
            for line in sb.splitlines():
                ym = _YEAR_HEAD.match(line)
                if ym:
                    year = _YEAR_NUM[ym.group(1)]
                for tier, name in _line_candidates(line):
                    if name in seen:
                        continue
                    seen.add(name)
                    (years[year] if year else pool).append((tier, name))
                ym = _YEAR_TAIL.search(line[-30:])
                if ym and not _YEAR_HEAD.match(line):  # 行尾「大二上学期是…」引出下一年
                    year = _YEAR_NUM[ym.group(1)]
        out = {k: [n for _, n in sorted(v, key=lambda x: x[0])][:6] for k, v in years.items()}
        # 未归年的（核心课程小节等）按文中顺序（基础→进阶）从大一到大四补进空位，补到各年均衡为止
        pool_names = [n for _, n in sorted(pool, key=lambda x: x[0])]
        if pool_names:
            total = sum(len(v) for v in out.values()) + len(pool_names)
            target = min(6, -(-total // 4))  # ceil
            it = iter(pool_names)
            for k in (1, 2, 3, 4):
                for n in it:
                    if len(out[k]) >= target:
                        # 这门放不下当前年，留给下一年
                        rest = [n] + list(it)
                        it = iter(rest)
                        break
                    out[k].append(n)
        return {f'y{k}': out[k] for k in (1, 2, 3, 4)}
    except Exception:
        return None


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
        courses = extract_courses(intro, secs)
        if courses is not None:
            detail['courses'] = courses
        (OUT_DETAIL / f'{name}.json').write_text(
            json.dumps(detail, ensure_ascii=False), encoding='utf-8')
        n_detail += 1

    OUT_CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=1), encoding='utf-8')
    size = sum(p.stat().st_size for p in OUT_DETAIL.glob('*.json'))
    print(f'catalog: {len(catalog)} majors ({OUT_CATALOG.stat().st_size // 1024}KB); '
          f'details: {n_detail} files ({size // 1024 // 1024}.{size // 1024 % 1024}MB)')


if __name__ == '__main__':
    main()
