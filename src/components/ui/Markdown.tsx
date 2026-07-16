import React from 'react';

/**
 * 极简 Markdown 渲染（AI 回答气泡用）：### 标题 / | 表格 | / - 列表 / 1. 有序列表 / **加粗**。
 * 只服务于 /content 里的预设文案，不处理任意输入。
 */

function inline(text: string, key?: React.Key): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <React.Fragment key={key}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <strong key={i} className="font-semibold text-ink">
            {p.slice(2, -2)}
          </strong>
        ) : (
          p
        ),
      )}
    </React.Fragment>
  );
}

/**
 * 提示词模板渲染：【填：xxx】为用户填空槽位（橙色高亮），其余为固定文本。
 */
export const PromptText: React.FC<{ text: string; className?: string }> = ({
  text,
  className = '',
}) => {
  const parts = text.split(/(【填：[^】]*】)/g);
  return (
    <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {parts.map((p, i) =>
        p.startsWith('【填：') ? (
          <mark
            key={i}
            className="mx-0.5 rounded border-b-2 border-dashed border-accent bg-accent-soft px-1.5 py-0.5 text-[0.92em] text-accent"
          >
            ✎ {p.slice(3, -1)}
          </mark>
        ) : (
          p
        ),
      )}
    </div>
  );
};

export function renderMarkdown(md: string): React.ReactNode {
  const lines = md.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // 代码块 ```
    if (line.trimStart().startsWith('```')) {
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1; // 跳过结尾 ```
      blocks.push(
        <pre
          key={key++}
          className="my-3 overflow-x-auto rounded-lg bg-ink/95 p-3 font-mono text-[12px] leading-relaxed text-paper"
        >
          {code.join('\n')}
        </pre>,
      );
      continue;
    }

    // 表格
    if (line.trimStart().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) {
        const cells = lines[i]
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i += 1;
      }
      const [head, ...body] = rows;
      blocks.push(
        <div key={key++} className="my-3 overflow-x-auto rounded-lg border border-line/70">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {head.map((c, j) => (
                  <th
                    key={j}
                    className="border-b-2 border-line bg-accent-soft/40 px-2.5 py-1.5 text-left font-semibold"
                  >
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="border-b border-line/70 last:border-b-0 even:bg-paper/60">
                  {r.map((c, j) => (
                    <td key={j} className="px-2.5 py-1.5 align-top leading-relaxed">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 标题
    if (line.startsWith('### ')) {
      blocks.push(
        <h4 key={key++} className="mb-1.5 mt-4 text-[14px] font-semibold tracking-wide first:mt-0">
          {inline(line.slice(4))}
        </h4>,
      );
      i += 1;
      continue;
    }

    // 无序列表
    if (line.trimStart().startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('- ')) {
        items.push(lines[i].trimStart().slice(2));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="my-2 flex list-disc flex-col gap-1 pl-5">
          {items.map((it, j) => (
            <li key={j} className="leading-relaxed">
              {inline(it)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    // 有序列表
    if (/^\d+[.．]\s/.test(line.trimStart())) {
      const items: string[] = [];
      while (i < lines.length && /^\d+[.．]\s/.test(lines[i].trimStart())) {
        items.push(lines[i].trimStart().replace(/^\d+[.．]\s/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={key++} className="my-2 flex list-decimal flex-col gap-1 pl-5">
          {items.map((it, j) => (
            <li key={j} className="leading-relaxed">
              {inline(it)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // 普通段落
    blocks.push(
      <p key={key++} className="my-1.5 leading-relaxed first:mt-0">
        {inline(line)}
      </p>,
    );
    i += 1;
  }

  return <div className="text-[13.5px]">{blocks}</div>;
}
