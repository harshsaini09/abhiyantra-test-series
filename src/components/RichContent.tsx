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
  type: 'text' | 'inline-code' | 'code-block' | 'inline-math' | 'display-math' | 'blank';
  content: string;
  language?: string;
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

export default function RichContent({ content, className = '', inline = false }: RichContentProps) {
  if (!content) return null;

  const segments = useMemo(() => tokenize(content), [content]);

  if (inline) {
    return (
      <span className={className}>
        {segments.map((seg, i) => {
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
          return <span key={i}>{seg.content}</span>;
        })}
      </span>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {segments.map((seg, i) => {
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
            {seg.content}
          </span>
        );
      })}
    </div>
  );
}
