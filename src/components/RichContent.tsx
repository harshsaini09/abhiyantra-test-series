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

interface Segment {
  type: 'text' | 'inline-code' | 'code-block' | 'inline-math' | 'display-math';
  content: string;
  language?: string;
}

function preprocessMath(raw: string): string {
  if (!raw) return '';

  // 1. Matrix shorthand: [[6, 2], [3, 4]] or [[1, 2, 3], [4, 5, 6]]
  let text = raw.replace(/\[\s*\[([^[\]]+)\](?:\s*,\s*\[([^[\]]+)\])+\s*\]/g, (fullMatch) => {
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

  // 3. Dimensions like 2x2, 2×2, 3x3, 4x4, nxn, mxn (e.g. "2×2 matrix" or "2x2 matrix" -> "$2 \times 2$ matrix")
  text = text.replace(/(\d+|n|m)\s*[xX\u00d7\u2715\*]\s*(\d+|n|m)/g, (_m, p1, p2) => `$${p1} \\times ${p2}$`);

  return text;
}

function tokenize(text: string): Segment[] {
  if (!text) return [];
  const processedText = preprocessMath(text);

  const segments: Segment[] = [];
  // Regex to match code blocks ```lang ... ```
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(processedText)) !== null) {
    if (match.index > lastIndex) {
      parseTextAndMath(processedText.slice(lastIndex, match.index), segments);
    }
    segments.push({
      type: 'code-block',
      language: (match[1] || 'c').toLowerCase().trim(),
      content: match[2].replace(/\n$/, ''),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < processedText.length) {
    parseTextAndMath(processedText.slice(lastIndex), segments);
  }

  return segments;
}

function parseTextAndMath(rawText: string, segments: Segment[]): void {
  // Matches display math $$...$$ or \[...\] and inline math $...$ or \(...\) and inline code `...`
  // Display math: \$\$([\s\S]*?)\$\$ | \\\[([\s\S]*?)\\\]
  // Inline math: \$([^\$\n]+?)\$ | \\\(([\s\S]*?)\\\)
  // Inline code: `([^`\n]+?)`
  const mixedRegex = /(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\$[^\$\n]+?\$|\\\([\s\S]*?\\\)|\`[^`\n]+?\`)/g;
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
      // Clean up accidental double-escaped LaTeX slashes (e.g. \\times -> \times)
      const cleaned = math.replace(/\\\\([a-zA-Z]+)/g, '\\$1');
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

export default function RichContent({ content, className = '', inline = false }: RichContentProps) {
  if (!content) return null;

  const segments = useMemo(() => tokenize(content), [content]);

  if (inline) {
    return (
      <span className={className}>
        {segments.map((seg, i) => {
          if (seg.type === 'inline-math') {
            return <KatexMath key={i} math={seg.content} displayMode={false} />;
          }
          if (seg.type === 'display-math') {
            return <KatexMath key={i} math={seg.content} displayMode={false} />;
          }
          if (seg.type === 'inline-code') {
            return (
              <code key={i} className="px-1.5 py-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-xs">
                {seg.content}
              </code>
            );
          }
          return <span key={i}>{seg.content}</span>;
        })}
      </span>
    );
  }

  return (
    <div className={`rich-content-flow ${className}`}>
      {segments.map((seg, i) => {
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
            <code key={i} className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-100 text-indigo-700 font-mono text-xs border border-slate-200">
              {seg.content}
            </code>
          );
        }

        // Standard text: preserve paragraphs & linebreaks
        const lines = seg.content.split('\n');
        return (
          <span key={i}>
            {lines.map((line, lineIdx) => (
              <span key={lineIdx}>
                {line}
                {lineIdx < lines.length - 1 && <br />}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
}
