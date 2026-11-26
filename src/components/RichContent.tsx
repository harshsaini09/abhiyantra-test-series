import { useMemo, useState } from 'react';
import katex from 'katex';
import Prism from 'prismjs';
// Common Prism languages for GATE
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-json';
import { Copy, Check } from 'lucide-react';

interface RichContentProps {
  content?: string | null;
  className?: string;
  inline?: boolean;
}

export interface TableData {
  caption?: string;
  headers: string[];
  alignments: ('left' | 'center' | 'right')[];
  rows: string[][];
}

interface Segment {
  type: 'text' | 'inline-code' | 'code-block' | 'inline-math' | 'display-math' | 'blank' | 'table';
  content: string;
  language?: string;
  tableData?: TableData;
}

/**
 * Universal preprocessor that converts raw unescaped math expressions,
 * matrices, limits, integrals, summations, and physics equations into KaTeX syntax.
 */
function preprocessMath(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // 1. Matrix shorthand: [[6, 2], [3, 4]] or [[1, 2, 3], [4, 5, 6]]
  text = text.replace(/\[\s*\[([^[\]]+)\](?:\s*,\s*\[([^[\]]+)\])+\s*\]/g, (fullMatch) => {
    const rowRegex = /\[([^[\]]+)\]/g;
    const rows: string[] = [];
    let rMatch: RegExpExecArray | null;
    while ((rMatch = rowRegex.exec(fullMatch)) !== null) {
      const items = rMatch[1].split(',').map((s) => s.trim()).join(' & ');
      rows.push(items);
    }
    return `$\\begin{bmatrix} ${rows.join(' \\\\ ')} \\end{bmatrix}$`;
  });

  // 2. Bare LaTeX matrix environments without $ or $$ (e.g. \begin{pmatrix}...\end{pmatrix})
  text = text.replace(
    /(?<!\$|\\\[)(\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix|aligned|cases)\}[\s\S]*?\\end\{(?:matrix|pmatrix|bmatrix|vmatrix|aligned|cases)\})(?!\$|\\\])/g,
    '$$$1$$'
  );

  // 3. Raw limits without delimiters: e.g. "lim(x → +∞) (10x² - 3x + 4) / (2x² + 9)" or "lim_{x \to 0} sin(x)/x"
  text = text.replace(
    /(?<!\$|\\\[)\b(lim\s*(?:\([^()]+\)|_\{[^}]+\}|_[a-zA-Z0-9\u2192\-\+]+)\s*[\(\)\w\s\^\+\-\*\/\u00b0-\u207f\u2080-\u2089\u00d7\u221e\.]+(?:\/[^\s,\.\?=]+)?)(?=\s*(?:={1,2}|________|\bis\b|[,\.\?]|$))/gi,
    (match) => `$${match.trim()}$`
  );

  // 4. Raw integrals without delimiters: e.g. "\int_{0}^{\pi} sin(x) dx" or "int(0 to 1) x^2 dx"
  text = text.replace(
    /(?<!\$|\\\[)\b(\\int\b[\s\S]*?d[a-zA-Z]|int\s*\([^()]+\)[\s\S]*?d[a-zA-Z])(?!\$|\\\])/gi,
    (match) => `$${match.trim()}$`
  );

  // 5. Raw summations without delimiters: e.g. "\sum_{i=1}^{n} i^2" or "sum(i=1 to n) i"
  text = text.replace(
    /(?<!\$|\\\[)\b(\\sum\b[\s\S]*?(?=[,\.\?;\)]|$)|sum\s*\([^()]+\)[\s\S]*?(?=[,\.\?;\)]|$))(?!\$|\\\])/gi,
    (match) => `$${match.trim()}$`
  );

  // 6. Dimensions like 2x2, 2×2, 3x3, 4x4, nxn, mxn (e.g. "2×2 matrix" -> "$2 \times 2$ matrix")
  text = text.replace(/(\d+|n|m)\s*[xX\u00d7\u2715\*]\s*(\d+|n|m)(?=\s+(?:matrix|dimension|array|tensor|grid))/gi, (_m, p1, p2) => `$${p1} \\times ${p2}$`);

  return text;
}

/**
 * Universal math sanitizer that transforms Unicode superscripts/subscripts,
 * limits, fractions, arrows, Greek letters, and physics symbols into proper KaTeX tokens.
 */
function cleanMathForKatex(rawMath: string): string {
  let math = rawMath.trim();

  // 1. Unicode superscripts: x², x³, xⁿ, x⁺¹, x⁻²
  const sups: Record<string, string> = {
    '\u00b0': '0',
    '\u00b9': '1',
    '\u00b2': '2',
    '\u00b3': '3',
    '\u2074': '4',
    '\u2075': '5',
    '\u2076': '6',
    '\u2077': '7',
    '\u2078': '8',
    '\u2079': '9',
    '\u207a': '+',
    '\u207b': '-',
    '\u207f': 'n',
  };
  math = math.replace(/([\w\)])([\u00b0\u00b1\u00b2\u00b3\u2074-\u2079\u207a\u207b\u207f]+)/g, (_, base, supStr) => {
    const norm = supStr.split('').map((c: string) => sups[c] || c).join('');
    return `${base}^{${norm}}`;
  });

  // 2. Unicode subscripts: x₀, x₁, x₂...
  const subs: Record<string, string> = {
    '\u2080': '0',
    '\u2081': '1',
    '\u2082': '2',
    '\u2083': '3',
    '\u2084': '4',
    '\u2085': '5',
    '\u2086': '6',
    '\u2087': '7',
    '\u2088': '8',
    '\u2089': '9',
  };
  math = math.replace(/([\w\)])([\u2080-\u2089]+)/g, (_, base, subStr) => {
    const norm = subStr.split('').map((c: string) => subs[c] || c).join('');
    return `${base}_{${norm}}`;
  });

  // 3. Arrow & standard mathematical and physics symbols
  math = math.replace(/(\u2192|-->|->|\bto\b)/g, ' \\to ');
  math = math.replace(/(\u221e|\binfinity\b|\binf\b)/gi, ' \\infty ');
  math = math.replace(/\u00d7/g, ' \\times ');
  math = math.replace(/\u00f7/g, ' \\div ');
  math = math.replace(/\u2264/g, ' \\le ');
  math = math.replace(/\u2265/g, ' \\ge ');
  math = math.replace(/\u2260/g, ' \\ne ');
  math = math.replace(/\u2248/g, ' \\approx ');
  math = math.replace(/\u00b1/g, ' \\pm ');
  math = math.replace(/\u2208/g, ' \\in ');
  math = math.replace(/\u2209/g, ' \\notin ');
  math = math.replace(/\u2282/g, ' \\subset ');
  math = math.replace(/\u2286/g, ' \\subseteq ');
  math = math.replace(/\u222a/g, ' \\cup ');
  math = math.replace(/\u2229/g, ' \\cap ');
  math = math.replace(/\u2200/g, ' \\forall ');
  math = math.replace(/\u2203/g, ' \\exists ');
  math = math.replace(/\u2202/g, ' \\partial ');
  math = math.replace(/\u2207/g, ' \\nabla ');

  // 4. Square roots: sqrt(x) -> \sqrt{x}
  math = math.replace(/\bsqrt\s*\(([^()]+)\)/gi, (_m, p1) => `\\sqrt{${p1.trim()}}`);

  // 5. Limits: lim(x \to \infty) or lim_(x \to 0) -> \lim_{x \to \infty}
  math = math.replace(/\blim\s*(?:\(([^()]+)\)|_\{([^}]+)\}|_([a-zA-Z0-9\\]+))/gi, (_, p1, p2, p3) => {
    const t = (p1 || p2 || p3 || '').trim();
    return `\\lim_{${t}} `;
  });

  // 6. Algebraic fractions: (A) / (B) -> \frac{A}{B}
  math = math.replace(/\(([^()]+)\)\s*\/\s*\(([^()]+)\)/g, (_m, p1, p2) => `\\frac{${p1.trim()}}{${p2.trim()}}`);

  // 7. Clean up double-escaped LaTeX slashes (e.g. \\times -> \times)
  math = math.replace(/\\\\([a-zA-Z]+)/g, '\\$1');

  // 8. Replace fill-in-the-blank lines inside LaTeX math with clean underlines
  math = math.replace(/(?:\\_\s*){2,}|_{3,}|\\textunderscore(?:\\textunderscore)+/g, ' \\underline{\\hspace{2cm}} ');

  return math;
}

function parseMarkdownTable(tableStr: string): TableData | null {
  const lines = tableStr
    .trim()
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.includes('|'));

  if (lines.length < 2) return null;

  const parseRow = (line: string): string[] => {
    return line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());
  };

  const headers = parseRow(lines[0]);
  const separatorLine = lines[1];

  // Must have separator row with dashes (e.g. |---|---|)
  if (!/^[|:\s-]+$/.test(separatorLine)) {
    return null;
  }

  const alignments: ('left' | 'center' | 'right')[] = parseRow(separatorLine).map((c) => {
    if (c.startsWith(':') && c.endsWith(':')) return 'center';
    if (c.endsWith(':')) return 'right';
    return 'left';
  });

  const rows = lines.slice(2).map(parseRow);
  return { headers, alignments, rows };
}

function parseLatexTable(tabularStr: string): TableData | null {
  const match = tabularStr.match(/\\begin\{tabular\}(?:\{[^}]*\})?([\s\S]*?)\\end\{tabular\}/);
  if (!match) return null;

  const body = match[1];
  const rawRows = body
    .split(/\\\\/g)
    .map((r) => r.replace(/\\hline/g, '').replace(/\\cline\{[^}]*\}/g, '').trim())
    .filter((r) => r.length > 0);

  if (rawRows.length < 1) return null;

  const parseRow = (row: string) => row.split('&').map((c) => c.trim());
  const headers = parseRow(rawRows[0]);
  const rows = rawRows.slice(1).map(parseRow);

  return {
    headers,
    alignments: headers.map(() => 'center'),
    rows,
  };
}

function tokenize(text: string): Segment[] {
  if (!text) return [];
  const processedText = preprocessMath(text);

  const segments: Segment[] = [];
  // Unified block regex matching:
  // 1. Code blocks: ```lang ... ```
  // 2. Markdown tables (with optional preceding caption like **Raider:**)
  // 3. LaTeX tabular tables
  const blockRegex =
    /(```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```|(?:^|\n)(?:(?:\*\*([^*]+)\*\*|([A-Za-z0-9_-]+):)\s*\n)?((?:[ \t]*\|[^\n]+\|[ \t]*(?:\n|$))+)|(?:^|\n)(\\begin\{tabular\}[\s\S]*?\\end\{tabular\}))/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(processedText)) !== null) {
    if (match.index > lastIndex) {
      parseTextAndMath(processedText.slice(lastIndex, match.index), segments);
    }

    const fullMatch = match[0];
    if (match[1] && match[1].startsWith('```')) {
      // Code block
      segments.push({
        type: 'code-block',
        language: (match[2] || 'c').toLowerCase().trim(),
        content: match[3].replace(/\n$/, ''),
      });
    } else if (match[6] && match[6].includes('|') && match[6].includes('-')) {
      // Markdown table
      const rawTable = match[6];
      const parsedTable = parseMarkdownTable(rawTable);
      if (parsedTable) {
        const rawCaption = (match[4] || match[5] || '').trim();
        const cleanCaption = rawCaption ? rawCaption.replace(/:$/, '').trim() : undefined;
        if (cleanCaption) {
          parsedTable.caption = cleanCaption;
        }
        segments.push({
          type: 'table',
          content: rawTable,
          tableData: parsedTable,
        });
      } else {
        parseTextAndMath(fullMatch, segments);
      }
    } else if (match[7]) {
      // LaTeX tabular table
      const rawTabular = match[7];
      const parsedTable = parseLatexTable(rawTabular);
      if (parsedTable) {
        segments.push({
          type: 'table',
          content: rawTabular,
          tableData: parsedTable,
        });
      } else {
        parseTextAndMath(fullMatch, segments);
      }
    } else {
      parseTextAndMath(fullMatch, segments);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < processedText.length) {
    parseTextAndMath(processedText.slice(lastIndex), segments);
  }

  return segments;
}

function parseTextAndMath(rawText: string, segments: Segment[]): void {
  // Matches display math $$...$$ or \[...\] and inline math $...$ or \(...\) and inline code `...` and fill-in-the-blank lines
  const mixedRegex =
    /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$\n]+?\$|\\\([\s\S]*?\\\)|\`[^`\n]+?\`|(?:\\_\s*){2,}|_{3,}|\\textunderscore(?:\\textunderscore)+|\[[\s_\\\\]{3,}\]|\([\s_\\\\]{3,}\))/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;

  while ((m = mixedRegex.exec(rawText)) !== null) {
    if (m.index > lastIdx) {
      segments.push({
        type: 'text',
        content: rawText.slice(lastIdx, m.index),
      });
    }

    const token = m[0];
    if (token.startsWith('$$') && token.endsWith('$$')) {
      segments.push({
        type: 'display-math',
        content: token.slice(2, -2).trim(),
      });
    } else if (token.startsWith('\\[') && token.endsWith('\\]')) {
      segments.push({
        type: 'display-math',
        content: token.slice(2, -2).trim(),
      });
    } else if (token.startsWith('$') && token.endsWith('$')) {
      segments.push({
        type: 'inline-math',
        content: token.slice(1, -1).trim(),
      });
    } else if (token.startsWith('\\(') && token.endsWith('\\)')) {
      segments.push({
        type: 'inline-math',
        content: token.slice(2, -2).trim(),
      });
    } else if (token.startsWith('`') && token.endsWith('`')) {
      segments.push({
        type: 'inline-code',
        content: token.slice(1, -1),
      });
    } else {
      // Fill-in-the-blank line token (e.g. \_\_\_\_\_\_ or ______ or [______])
      segments.push({
        type: 'blank',
        content: token,
      });
    }

    lastIdx = m.index + token.length;
  }

  if (lastIdx < rawText.length) {
    segments.push({
      type: 'text',
      content: rawText.slice(lastIdx),
    });
  }
}

function CodeBlockView({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const highlightedHtml = useMemo(() => {
    try {
      const grammar = Prism.languages[language] || Prism.languages.c || Prism.languages.javascript;
      return Prism.highlight(code, grammar, language || 'c');
    } catch {
      return code;
    }
  }, [code, language]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 shadow-md text-xs sm:text-sm">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-800/80 border-b border-slate-700 text-slate-300">
        <span className="font-mono text-xs uppercase font-semibold text-indigo-300">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto text-slate-100 font-mono leading-relaxed">
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </div>
  );
}

function KatexMath({ math, displayMode }: { math: string; displayMode: boolean }) {
  const html = useMemo(() => {
    try {
      const cleaned = cleanMathForKatex(math);
      return katex.renderToString(cleaned, {
        displayMode,
        throwOnError: false,
        output: 'htmlAndMathml',
      });
    } catch {
      return math;
    }
  }, [math, displayMode]);

  if (displayMode) {
    return (
      <div
        className="my-2 py-1.5 px-2 overflow-x-auto text-center"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <span
      className="inline-math px-0.5"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function BlankField() {
  return (
    <span
      className="inline-block border-b-2 border-slate-700 min-w-[65px] sm:min-w-[85px] mx-1.5 h-[1.1em] align-baseline relative top-[-1px] select-none"
      title="Fill in the blank"
      aria-label="fill in the blank"
    />
  );
}

function TableView({ tableData }: { tableData: TableData }) {
  const { caption, headers, alignments = [], rows } = tableData;

  return (
    <div className="my-3 overflow-x-auto flex flex-col items-start sm:items-center">
      <table className="border-collapse border-2 border-slate-700 bg-white text-xs sm:text-sm shadow-xs rounded-sm overflow-hidden min-w-[240px]">
        {caption && (
          <thead>
            <tr>
              <th
                colSpan={headers.length || 1}
                className="py-2 px-3 text-center font-bold text-xs sm:text-sm bg-slate-100 border border-slate-700 text-slate-900 tracking-wide"
              >
                <RichContent content={caption} inline />
              </th>
            </tr>
          </thead>
        )}
        <thead>
          <tr className="bg-slate-50">
            {headers.map((h, i) => {
              const align = alignments[i] || 'center';
              return (
                <th
                  key={i}
                  className={`py-2 px-3.5 font-bold text-xs sm:text-sm border border-slate-700 text-slate-900 ${
                    align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'
                  }`}
                >
                  <RichContent content={h} inline />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-slate-50/80 transition-colors">
              {row.map((cell, cIdx) => {
                const align =
                  alignments[cIdx] ||
                  (cell.trim().length <= 4 || /^\d+$/.test(cell.trim()) ? 'center' : 'left');
                return (
                  <td
                    key={cIdx}
                    className={`py-1.5 px-3.5 border border-slate-700 text-slate-800 text-xs sm:text-sm font-medium ${
                      align === 'left' ? 'text-left' : align === 'right' ? 'text-right' : 'text-center'
                    }`}
                  >
                    <RichContent content={cell} inline />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderFormattedInlineText(text: string) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+?\*\*|\*[^*]+?\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-slate-800">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

export default function RichContent({ content, className = '', inline = false }: RichContentProps) {
  if (!content) return null;

  const segments = useMemo(() => tokenize(content), [content]);

  if (inline) {
    return (
      <span className={className}>
        {segments.map((seg, i) => {
          if (seg.type === 'table' && seg.tableData) {
            return <TableView key={i} tableData={seg.tableData} />;
          }
          if (seg.type === 'blank') {
            return <BlankField key={i} />;
          }
          if (seg.type === 'inline-math') {
            return <KatexMath key={i} math={seg.content} displayMode={false} />;
          }
          if (seg.type === 'display-math') {
            return <KatexMath key={i} math={seg.content} displayMode={false} />;
          }
          if (seg.type === 'inline-code') {
            return (
              <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-indigo-700 border border-slate-200">
                {seg.content}
              </code>
            );
          }
          return <span key={i}>{renderFormattedInlineText(seg.content)}</span>;
        })}
      </span>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {segments.map((seg, i) => {
        if (seg.type === 'table' && seg.tableData) {
          return <TableView key={i} tableData={seg.tableData} />;
        }
        if (seg.type === 'blank') {
          return <BlankField key={i} />;
        }
        if (seg.type === 'code-block') {
          return <CodeBlockView key={i} code={seg.content} language={seg.language || 'c'} />;
        }
        if (seg.type === 'display-math') {
          return <KatexMath key={i} math={seg.content} displayMode={true} />;
        }
        if (seg.type === 'inline-math') {
          return <KatexMath key={i} math={seg.content} displayMode={false} />;
        }
        if (seg.type === 'inline-code') {
          return (
            <code key={i} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs sm:text-sm text-indigo-700 border border-slate-200">
              {seg.content}
            </code>
          );
        }
        return (
          <span key={i} className="whitespace-pre-wrap leading-relaxed">
            {renderFormattedInlineText(seg.content)}
          </span>
        );
      })}
    </div>
  );
}
