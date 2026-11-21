import { useEffect, useRef, useState } from 'react';
import { Sparkles, Code2, AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface TikzDiagramProps {
  tikzCode?: string;
  code?: string;
  caption?: string;
}

// Global script loader helper
let tikzJaxLoaded = false;
let tikzJaxLoading = false;
const loadCallbacks: Array<() => void> = [];

function loadTikzJax(callback: () => void) {
  if (tikzJaxLoaded || (window as any).tikzjax) {
    callback();
    return;
  }

  loadCallbacks.push(callback);

  if (!tikzJaxLoading) {
    tikzJaxLoading = true;

    // Inject fonts CSS
    if (!document.querySelector('link[href*="tikzjax"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://tikzjax.com/v1/fonts.css';
      document.head.appendChild(link);
    }

    // Inject JS
    const script = document.createElement('script');
    script.src = 'https://tikzjax.com/v1/tikzjax.js';
    script.async = true;
    script.onload = () => {
      tikzJaxLoaded = true;
      tikzJaxLoading = false;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    script.onerror = () => {
      tikzJaxLoading = false;
      loadCallbacks.forEach((cb) => cb());
      loadCallbacks.length = 0;
    };
    document.head.appendChild(script);
  }
}

export default function TikzDiagram({ tikzCode, code, caption }: TikzDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showRawCode, setShowRawCode] = useState(false);

  const rawCode = (tikzCode || code || '').trim();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(false);

    // Normalize code: wrap in \begin{tikzpicture}...\end{tikzpicture} if not wrapped
    let codeToRender = rawCode;
    if (!codeToRender) {
      setLoading(false);
      return;
    }
    if (!codeToRender.includes('\\begin{tikzpicture}')) {
      codeToRender = `\\begin{tikzpicture}\n${codeToRender}\n\\end{tikzpicture}`;
    }

    const container = containerRef.current;
    if (!container) return;

    // Clear previous output
    container.innerHTML = '';

    // Create the script tag for TikZJax
    const tikzScript = document.createElement('script');
    tikzScript.type = 'text/tikz';
    tikzScript.textContent = codeToRender;
    container.appendChild(tikzScript);

    // Timeout safety if offline or compilation fails
    const timer = setTimeout(() => {
      if (mounted) {
        const svg = container.querySelector('svg');
        if (!svg) {
          setError(true);
          setLoading(false);
        }
      }
    }, 9000);

    // Load and trigger TikZJax
    loadTikzJax(() => {
      if (!mounted) return;

      // TikZJax automatically observes DOM mutations for script[type="text/tikz"],
      // but if already loaded, we can trigger processTikz if available
      if ((window as any).processTikz) {
        try {
          (window as any).processTikz(tikzScript);
        } catch {
          // ignore
        }
      }

      // Check if svg was rendered
      const checkSvg = setInterval(() => {
        if (!mounted) {
          clearInterval(checkSvg);
          return;
        }
        if (container.querySelector('svg')) {
          clearInterval(checkSvg);
          clearTimeout(timer);
          setLoading(false);
          setError(false);
        }
      }, 250);
    });

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [tikzCode]);

  return (
    <div className="my-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          TikZ Vector Diagram
        </span>

        <button
          type="button"
          onClick={() => setShowRawCode(!showRawCode)}
          className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-medium transition"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{showRawCode ? 'Hide Code' : 'View TikZ Code'}</span>
          {showRawCode ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs font-medium">Compiling TikZ Vector Diagram...</span>
        </div>
      )}

      {/* Container where TikZJax compiles to SVG */}
      <div
        ref={containerRef}
        className={`flex justify-center items-center overflow-x-auto min-h-[100px] [&>svg]:max-w-full [&>svg]:h-auto transition-opacity ${
          loading ? 'opacity-0 h-0' : 'opacity-100'
        }`}
      />

      {/* Error Fallback */}
      {error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-2">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>TikZ Compiler Notice</span>
          </div>
          <p className="text-amber-700">
            Vector diagram could not be pre-rendered directly (offline or CDN blocked). You can view the raw TikZ specification below:
          </p>
          <pre className="p-2.5 rounded-lg bg-slate-900 text-emerald-300 font-mono text-xs overflow-x-auto">
            <code>{tikzCode}</code>
          </pre>
        </div>
      )}

      {/* Optional Raw Code Collapsible Panel */}
      {showRawCode && !error && (
        <div className="mt-3 p-3 bg-slate-900 rounded-xl text-slate-200 font-mono text-xs overflow-x-auto border border-slate-700">
          <pre>
            <code>{tikzCode}</code>
          </pre>
        </div>
      )}

      {caption && <p className="text-xs text-slate-500 mt-2 text-center italic">{caption}</p>}
    </div>
  );
}
