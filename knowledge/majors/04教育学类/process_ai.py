#!/usr/bin/env python3
"""
AI去味优化脚本 - 处理教育学类文档
"""
import re
import os
from pathlib import Path

# AI模板词/句（需要删除或替换的）
AI_PATTERNS_TO_DELETE = [
    r'说实话，',
    r'掏心窝子的话',
    r'祝大家',
    r'希望对大家有帮助',
    r'废话不多说',
    r'文末彩蛋',
    r'最后说一句掏心窝子的话',
    r'我是[^\s，。]+',  # "我是XX"开头的自我介绍
    r'说实话，我当年',
    r'我是[^\s]+专业',
    r'干了这么多年',
    r'用我的亲身经历',
    r'能帮到正在选专业',
]

# 需要删除的段落（包含AI模板词的整句/段落）
AI_WHOLE_PATTERNS = [
    r'今天把我.*全部分享出来.*希望.*\n?',
    r'希望能帮到正在选专业.*\n?',
    r'分享一些真实的经历和感受.*\n?',
]

def remove_ai_phrases(text):
    """删除AI模板词句"""
    result = text
    
    # 删除整个段落（包含AI模板词）
    for pattern in AI_WHOLE_PATTERNS:
        result = re.sub(pattern, '', result)
    
    # 删除/替换特定AI短语
    for pattern in AI_PATTERNS_TO_DELETE:
        result = re.sub(pattern, '', result)
    
    return result

def convert_headers(text):
    """将 ### 标题 转换为 **标题**"""
    lines = text.split('\n')
    result_lines = []
    
    for line in lines:
        # 匹配 ### 开头的标题（但不是 ### xxx ### 格式的）
        if re.match(r'^#{1,3}\s+[^\s]', line):
            # 移除 ### 并转换为加粗格式
            title = re.sub(r'^#{1,3}\s+', '', line)
            result_lines.append(f"**{title}**")
        else:
            result_lines.append(line)
    
    return '\n'.join(result_lines)

def clean_text(text):
    """综合清理"""
    text = remove_ai_phrases(text)
    text = convert_headers(text)
    return text

def process_file(filepath):
    """处理单个文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    processed_content = clean_text(content)
    
    if processed_content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(processed_content)
        return True
    return False

def main():
    base_dir = Path("/Users/shiyuan/Desktop/知识库汇总/浪尖知识库2026/1002中国大学的专业规划/04教育学类")
    
    total_files = 0
    modified_files = 0
    
    # 处理教育学类子目录
    jiaoyu_dir = base_dir / "教育学类"
    if jiaoyu_dir.exists():
        for md_file in jiaoyu_dir.glob("*.md"):
            if "目录索引" in md_file.name or "PROCESSED" in md_file.name:
                continue
            total_files += 1
            if process_file(md_file):
                modified_files += 1
            print(f"处理: {md_file.name}")
    
    # 处理体育学类子目录
    tiyu_dir = base_dir / "体育学类"
    if tiyu_dir.exists():
        for md_file in tiyu_dir.glob("*.md"):
            if "目录索引" in md_file.name or "PROCESSED" in md_file.name:
                continue
            total_files += 1
            if process_file(md_file):
                modified_files += 1
            print(f"处理: {md_file.name}")
    
    print(f"\n总计: {total_files} 个文件, 修改了 {modified_files} 个文件")

if __name__ == "__main__":
    main()
