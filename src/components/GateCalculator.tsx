import { useState, useRef, useEffect } from 'react';
import { X, Calculator, GripHorizontal } from 'lucide-react';

interface GateCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

type AngleMode = 'deg' | 'rad';

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n) || n > 170) return NaN;
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

export default function GateCalculator({ isOpen, onClose }: GateCalculatorProps) {
  // Calculator state
  const [display, setDisplay] = useState('0');
  const [formula, setFormula] = useState('');
  const [angleMode, setAngleMode] = useState<AngleMode>('deg');
  const [memory, setMemory] = useState<number>(0);
  const [hasMemory, setHasMemory] = useState(false);
  const [isNewEntry, setIsNewEntry] = useState(true);
  const [prevOp, setPrevOp] = useState<string | null>(null);
  const [storedValue, setStoredValue] = useState<number | null>(null);

  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    // Default to top-right corner
    return {
      x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 480) : 100,
      y: 75,
    };
  });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initX: position.x,
      initY: position.y,
    };
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      const newX = Math.max(10, Math.min(window.innerWidth - 440, dragStartRef.current.initX + dx));
      const newY = Math.max(10, Math.min(window.innerHeight - 380, dragStartRef.current.initY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Format number for display
  const formatResult = (val: number): string => {
    if (isNaN(val)) return 'Error';
    if (!isFinite(val)) return val > 0 ? 'Infinity' : '-Infinity';
    // Limit precision
    const str = val.toPrecision(12);
    return String(parseFloat(str));
  };

  // Arithmetic operations
  const inputDigit = (digit: string) => {
    if (isNewEntry || display === '0' || display === 'Error') {
      setDisplay(digit);
      setIsNewEntry(false);
    } else {
      if (display.length < 16) {
        setDisplay(display + digit);
      }
    }
  };

  const inputDot = () => {
    if (isNewEntry || display === 'Error') {
      setDisplay('0.');
      setIsNewEntry(false);
    } else if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clearAll = () => {
    setDisplay('0');
    setFormula('');
    setPrevOp(null);
    setStoredValue(null);
    setIsNewEntry(true);
  };

  const clearEntry = () => {
    setDisplay('0');
    setIsNewEntry(true);
  };

  const backspace = () => {
    if (display === 'Error' || isNewEntry) {
      setDisplay('0');
      setIsNewEntry(true);
    } else if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
      setIsNewEntry(true);
    }
  };

  const toggleSign = () => {
    if (display === 'Error' || display === '0') return;
    if (display.startsWith('-')) {
      setDisplay(display.slice(1));
    } else {
      setDisplay('-' + display);
    }
  };

  // Binary operators (+, -, *, /, mod, x^y)
  const handleOperator = (op: string) => {
    const current = parseFloat(display);
    if (isNaN(current)) return;

    if (storedValue !== null && prevOp && !isNewEntry) {
      const res = calculateBinary(storedValue, current, prevOp);
      setDisplay(formatResult(res));
      setStoredValue(res);
      setFormula(`${formatResult(res)} ${op}`);
    } else {
      setStoredValue(current);
      setFormula(`${display} ${op}`);
    }
    setPrevOp(op);
    setIsNewEntry(true);
  };

  const calculateBinary = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '×':
      case '*':
        return a * b;
      case '÷':
      case '/':
        return b !== 0 ? a / b : NaN;
      case 'mod':
        return a % b;
      case 'x^y':
        return Math.pow(a, b);
      default:
        return b;
    }
  };

  const handleEquals = () => {
    if (storedValue === null || !prevOp) return;
    const current = parseFloat(display);
    const res = calculateBinary(storedValue, current, prevOp);
    setFormula(`${formula} ${display} =`);
    setDisplay(formatResult(res));
    setStoredValue(null);
    setPrevOp(null);
    setIsNewEntry(true);
  };

  // Unary scientific functions
  const handleScientific = (fn: string) => {
    const x = parseFloat(display);
    if (isNaN(x)) return;

    let res = 0;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    switch (fn) {
      case 'sin':
        res = Math.sin(angleMode === 'deg' ? toRad(x) : x);
        break;
      case 'cos':
        res = Math.cos(angleMode === 'deg' ? toRad(x) : x);
        break;
      case 'tan':
        res = Math.tan(angleMode === 'deg' ? toRad(x) : x);
        break;
      case 'asin':
        res = Math.asin(x);
        if (angleMode === 'deg') res = toDeg(res);
        break;
      case 'acos':
        res = Math.acos(x);
        if (angleMode === 'deg') res = toDeg(res);
        break;
      case 'atan':
        res = Math.atan(x);
        if (angleMode === 'deg') res = toDeg(res);
        break;
      case 'sinh':
        res = Math.sinh(x);
        break;
      case 'cosh':
        res = Math.cosh(x);
        break;
      case 'tanh':
        res = Math.tanh(x);
        break;
      case 'ln':
        res = x > 0 ? Math.log(x) : NaN;
        break;
      case 'log10':
        res = x > 0 ? Math.log10(x) : NaN;
        break;
      case 'e^x':
        res = Math.exp(x);
        break;
      case '10^x':
        res = Math.pow(10, x);
        break;
      case 'x^2':
        res = x * x;
        break;
      case 'x^3':
        res = x * x * x;
        break;
      case 'sqrt':
        res = x >= 0 ? Math.sqrt(x) : NaN;
        break;
      case 'cbrt':
        res = Math.cbrt(x);
        break;
      case '1/x':
        res = x !== 0 ? 1 / x : NaN;
        break;
      case 'n!':
        res = factorial(x);
        break;
      default:
        return;
    }

    setFormula(`${fn}(${display})`);
    setDisplay(formatResult(res));
    setIsNewEntry(true);
  };

  const handleConstant = (c: 'pi' | 'e') => {
    const val = c === 'pi' ? Math.PI : Math.E;
    setDisplay(formatResult(val));
    setIsNewEntry(true);
  };

  // Memory functions
  const handleMemory = (action: 'MC' | 'MR' | 'MS' | 'M+' | 'M-') => {
    const current = parseFloat(display) || 0;
    switch (action) {
      case 'MC':
        setMemory(0);
        setHasMemory(false);
        break;
      case 'MR':
        if (hasMemory) {
          setDisplay(formatResult(memory));
          setIsNewEntry(true);
        }
        break;
      case 'MS':
        setMemory(current);
        setHasMemory(current !== 0);
        setIsNewEntry(true);
        break;
      case 'M+':
        setMemory((m) => {
          const next = m + current;
          setHasMemory(next !== 0);
          return next;
        });
        setIsNewEntry(true);
        break;
      case 'M-':
        setMemory((m) => {
          const next = m - current;
          setHasMemory(next !== 0);
          return next;
        });
        setIsNewEntry(true);
        break;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
      }}
      className="w-[430px] max-w-[96vw] bg-slate-900 border-2 border-slate-700 text-white rounded-2xl shadow-2xl overflow-hidden select-none font-sans"
    >
      {/* ─── Drag Header ─── */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-3.5 py-2.5 bg-slate-800 border-b border-slate-700 cursor-move text-xs font-bold text-slate-200"
      >
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-indigo-400" />
          <span>GATE Scientific Calculator</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
            TCS-iON Style
          </span>
        </div>
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-500" />
          <button
            onClick={onClose}
            className="p-1 hover:bg-red-600 rounded text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ─── Display & Status Ribbon ─── */}
      <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 space-y-1">
        {/* Status Pills */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <span
              onClick={() => setAngleMode(angleMode === 'deg' ? 'rad' : 'deg')}
              className="cursor-pointer px-1.5 py-0.5 rounded bg-slate-800 text-indigo-300 hover:bg-slate-700 font-bold"
            >
              [{angleMode.toUpperCase()}]
            </span>
            {hasMemory && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-bold">
                [M: {formatResult(memory)}]
              </span>
            )}
          </div>
          <span className="truncate max-w-[200px] text-slate-500">{formula}</span>
        </div>

        {/* Current Result / Number */}
        <div className="text-right text-2xl font-mono font-bold text-emerald-400 tracking-wide overflow-x-auto whitespace-nowrap py-1">
          {display}
        </div>
      </div>

      {/* ─── Keypad Grid ─── */}
      <div className="p-3 bg-slate-900 grid grid-cols-6 gap-1.5 text-xs font-semibold">
        {/* Row 1: Memory & Angle Toggle */}
        <button
          onClick={() => setAngleMode(angleMode === 'deg' ? 'rad' : 'deg')}
          className="col-span-1 p-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30"
        >
          {angleMode === 'deg' ? 'Deg' : 'Rad'}
        </button>
        <button
          onClick={() => handleMemory('MC')}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          MC
        </button>
        <button
          onClick={() => handleMemory('MR')}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          MR
        </button>
        <button
          onClick={() => handleMemory('MS')}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          MS
        </button>
        <button
          onClick={() => handleMemory('M+')}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          M+
        </button>
        <button
          onClick={() => handleMemory('M-')}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          M-
        </button>

        {/* Row 2: Trig & Clear */}
        <button
          onClick={() => handleScientific('sin')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          sin
        </button>
        <button
          onClick={() => handleScientific('cos')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          cos
        </button>
        <button
          onClick={() => handleScientific('tan')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          tan
        </button>
        <button
          onClick={clearEntry}
          className="p-2 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 border border-amber-500/30"
        >
          CE
        </button>
        <button
          onClick={clearAll}
          className="p-2 rounded-lg bg-red-600/40 hover:bg-red-600/60 text-red-200 border border-red-500/30"
        >
          C
        </button>
        <button
          onClick={backspace}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          ⌫
        </button>

        {/* Row 3: Inverse Trig & Arithmetic */}
        <button
          onClick={() => handleScientific('asin')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          asin
        </button>
        <button
          onClick={() => handleScientific('acos')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          acos
        </button>
        <button
          onClick={() => handleScientific('atan')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          atan
        </button>
        <button
          onClick={() => inputDigit('7')}
          className="p-2.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white font-bold text-sm"
        >
          7
        </button>
        <button
          onClick={() => inputDigit('8')}
          className="p-2.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white font-bold text-sm"
        >
          8
        </button>
        <button
          onClick={() => inputDigit('9')}
          className="p-2.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white font-bold text-sm"
        >
          9
        </button>

        {/* Row 4: Hyperbolic & Numbers */}
        <button
          onClick={() => handleScientific('sinh')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          sinh
        </button>
        <button
          onClick={() => handleScientific('cosh')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          cosh
        </button>
        <button
          onClick={() => handleScientific('tanh')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          tanh
        </button>
        <button
          onClick={() => inputDigit('4')}
          className="p-2.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white font-bold text-sm"
        >
          4
        </button>
        <button
          onClick={() => inputDigit('5')}
          className="p-2.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white font-bold text-sm"
        >
          5
        </button>
        <button
          onClick={() => inputDigit('6')}
          className="p-2.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white font-bold text-sm"
        >
          6
        </button>

        {/* Row 5: Logarithms & Multiply/Divide */}
        <button
          onClick={() => handleScientific('ln')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          ln
        </button>
        <button
          onClick={() => handleScientific('log10')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          log₁₀
        </button>
        <button
          onClick={() => handleOperator('÷')}
          className="p-2 rounded-lg bg-indigo-600/40 hover:bg-indigo-600 text-indigo-200 text-base font-bold"
        >
          ÷
        </button>
        <button
          onClick={() => inputDigit('1')}
          className="p-2.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white font-bold text-sm"
        >
          1
        </button>
        <button
          onClick={() => inputDigit('2')}
          className="p-2.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white font-bold text-sm"
        >
          2
        </button>
        <button
          onClick={() => inputDigit('3')}
          className="p-2.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white font-bold text-sm"
        >
          3
        </button>

        {/* Row 6: Exponentials & Plus/Minus */}
        <button
          onClick={() => handleScientific('e^x')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          eˣ
        </button>
        <button
          onClick={() => handleScientific('10^x')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          10ˣ
        </button>
        <button
          onClick={() => handleOperator('×')}
          className="p-2 rounded-lg bg-indigo-600/40 hover:bg-indigo-600 text-indigo-200 text-base font-bold"
        >
          ×
        </button>
        <button
          onClick={toggleSign}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          ±
        </button>
        <button
          onClick={() => inputDigit('0')}
          className="p-2.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white font-bold text-sm"
        >
          0
        </button>
        <button
          onClick={inputDot}
          className="p-2.5 rounded-lg bg-slate-700/80 hover:bg-slate-600 text-white font-bold text-sm"
        >
          .
        </button>

        {/* Row 7: Powers, Roots & Operations */}
        <button
          onClick={() => handleScientific('x^2')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          x²
        </button>
        <button
          onClick={() => handleScientific('x^3')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          x³
        </button>
        <button
          onClick={() => handleOperator('-')}
          className="p-2 rounded-lg bg-indigo-600/40 hover:bg-indigo-600 text-indigo-200 text-base font-bold"
        >
          −
        </button>
        <button
          onClick={() => handleScientific('sqrt')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          √x
        </button>
        <button
          onClick={() => handleScientific('cbrt')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          ∛x
        </button>
        <button
          onClick={() => handleOperator('+')}
          className="p-2 rounded-lg bg-indigo-600/40 hover:bg-indigo-600 text-indigo-200 text-base font-bold"
        >
          +
        </button>

        {/* Row 8: Powers, Factorial, Constants & Equals */}
        <button
          onClick={() => handleOperator('x^y')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          xʸ
        </button>
        <button
          onClick={() => handleScientific('1/x')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          1/x
        </button>
        <button
          onClick={() => handleScientific('n!')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          n!
        </button>
        <button
          onClick={() => handleConstant('pi')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          π
        </button>
        <button
          onClick={() => handleConstant('e')}
          className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200"
        >
          e
        </button>
        <button
          onClick={handleEquals}
          className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg shadow-sm"
        >
          =
        </button>
      </div>
    </div>
  );
}
