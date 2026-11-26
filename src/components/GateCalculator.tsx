import { useState, useRef, useEffect } from 'react';
import { Minus, X, HelpCircle } from 'lucide-react';

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
  const [isMinimized, setIsMinimized] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    return {
      x: typeof window !== 'undefined' ? Math.max(10, window.innerWidth - 530) : 100,
      y: 65,
    };
  });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initX: number; initY: number }>({
    startX: 0,
    startY: 0,
    initX: 0,
    initY: 0,
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag from header, ignore buttons inside header
    if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') return;
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
      const newX = Math.max(0, Math.min(window.innerWidth - 420, dragStartRef.current.initX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 150, dragStartRef.current.initY + dy));
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

  // Binary operators (+, -, *, /, mod, xʸ, logyx, ʸ√x, Exp)
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
      case '*':
        return a * b;
      case '/':
        return b !== 0 ? a / b : NaN;
      case 'mod':
        return a % b;
      case 'xʸ':
        return Math.pow(a, b);
      case 'ʸ√x':
        return b !== 0 ? Math.pow(a, 1 / b) : NaN;
      case 'logyx':
        return a > 0 && b > 0 && b !== 1 ? Math.log(a) / Math.log(b) : NaN;
      case 'Exp':
        return a * Math.pow(10, b);
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
      case 'asinh':
        res = Math.asinh(x);
        break;
      case 'acosh':
        res = Math.acosh(x);
        break;
      case 'atanh':
        res = Math.atanh(x);
        break;
      case 'ln':
        res = x > 0 ? Math.log(x) : NaN;
        break;
      case 'log':
        res = x > 0 ? Math.log10(x) : NaN;
        break;
      case 'log2':
        res = x > 0 ? Math.log2(x) : NaN;
        break;
      case 'eˣ':
        res = Math.exp(x);
        break;
      case '10ˣ':
        res = Math.pow(10, x);
        break;
      case 'x²':
        res = x * x;
        break;
      case 'x³':
        res = x * x * x;
        break;
      case '√':
        res = x >= 0 ? Math.sqrt(x) : NaN;
        break;
      case '∛x':
        res = Math.cbrt(x);
        break;
      case '1/x':
        res = x !== 0 ? 1 / x : NaN;
        break;
      case '|x|':
        res = Math.abs(x);
        break;
      case 'n!':
        res = factorial(x);
        break;
      case '%':
        res = x / 100;
        break;
      default:
        return;
    }

    setFormula(`${fn}(${display})`);
    setDisplay(formatResult(res));
    setIsNewEntry(true);
  };

  const handleConstant = (c: 'π' | 'e') => {
    const val = c === 'π' ? Math.PI : Math.E;
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

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <div
      style={
        isMobile
          ? {
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 9999,
              width: '95vw',
              maxWidth: '480px',
            }
          : {
              position: 'fixed',
              left: `${position.x}px`,
              top: `${position.y}px`,
              zIndex: 9999,
            }
      }
      className="w-full sm:w-[505px] max-w-[98vw] bg-[#e6e6e6] border border-[#7f9db9] shadow-[0_10px_30px_rgba(0,0,0,0.45)] select-none font-sans text-[#222] rounded-lg overflow-hidden"
    >
      {/* ─── TCS-iON Blue Title Bar ─── */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-3 py-1.5 bg-[#2196f3] text-white cursor-move"
      >
        <span className="text-sm font-semibold tracking-wide">Scientific Calculator</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="px-3 py-0.5 rounded-full bg-[#00bcd4] hover:bg-[#00acc1] text-white text-xs font-medium shadow-sm transition"
          >
            Help
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-[#1976d2] rounded text-white transition flex items-center justify-center w-6 h-6"
            title="Minimize"
          >
            <Minus className="w-3.5 h-3.5 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-[#d32f2f] rounded text-white transition flex items-center justify-center w-6 h-6"
            title="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* ─── Help Dialog Overlay ─── */}
      {showHelp && (
        <div className="p-3 bg-[#fff9c4] border-b border-[#fbc02d] text-xs text-slate-800 space-y-1">
          <div className="flex items-center justify-between font-bold text-[#b78103]">
            <span className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" /> Official GATE Calculator Help
            </span>
            <button
              onClick={() => setShowHelp(false)}
              className="text-xs text-slate-500 hover:text-slate-800 underline"
            >
              Close Help
            </button>
          </div>
          <p>
            • Select <strong>Deg</strong> or <strong>Rad</strong> for trigonometric computations.
          </p>
          <p>
            • Use <strong>mod</strong> for remainder, <strong>xʸ</strong> for exponents, and{' '}
            <strong>ʸ√x</strong> for roots.
          </p>
          <p>
            • Memory keys: <strong>MS</strong> saves value, <strong>MR</strong> recalls,{' '}
            <strong>MC</strong> clears memory.
          </p>
        </div>
      )}

      {/* ─── Calculator Body (Hidden when Minimized) ─── */}
      {!isMinimized && (
        <div className="p-2.5 space-y-2 bg-[#dcdcdc]">
          {/* Top Formula / Expression Display */}
          <div className="w-full bg-white border border-[#a0a0a0] px-2 py-1 h-7 text-right text-xs font-mono text-slate-600 overflow-x-auto whitespace-nowrap shadow-inner">
            {formula || '\u00A0'}
          </div>

          {/* Main Number Display (Big bold '0') */}
          <div className="w-full bg-white border border-[#a0a0a0] px-2 py-1 h-10 text-right text-2xl font-bold font-mono text-black overflow-x-auto whitespace-nowrap shadow-inner flex items-center justify-end">
            {display}
          </div>

          {/* ─── Keypad Grid matching Official TCS-iON ─── */}
          <div className="space-y-1.5 pt-1">
            {/* ROW 1: mod | (o) Deg ( ) Rad | MC | MR | MS | M+ | M- */}
            <div className="flex items-center justify-between gap-1 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOperator('mod')}
                  className="w-12 h-7 bg-[#f3f3f3] hover:bg-[#e8e8e8] active:bg-[#d0d0d0] border border-[#a9a9a9] rounded-sm font-semibold text-slate-800 shadow-xs"
                >
                  mod
                </button>
                <div className="flex items-center gap-2 pl-1 text-[11px] font-medium text-slate-800">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="angleMode"
                      checked={angleMode === 'deg'}
                      onChange={() => setAngleMode('deg')}
                      className="accent-[#2196f3] w-3 h-3 cursor-pointer"
                    />
                    <span>Deg</span>
                  </label>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="angleMode"
                      checked={angleMode === 'rad'}
                      onChange={() => setAngleMode('rad')}
                      className="accent-[#2196f3] w-3 h-3 cursor-pointer"
                    />
                    <span>Rad</span>
                  </label>
                  {hasMemory && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded border border-emerald-300">
                      M
                    </span>
                  )}
                </div>
              </div>

              {/* Memory Buttons */}
              <div className="flex items-center gap-1">
                {(['MC', 'MR', 'MS', 'M+', 'M-'] as const).map((mKey) => (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => handleMemory(mKey)}
                    className="w-10 h-7 bg-[#f3f3f3] hover:bg-[#e8e8e8] active:bg-[#d0d0d0] border border-[#a9a9a9] rounded-sm font-medium text-slate-800 text-xs shadow-xs"
                  >
                    {mKey}
                  </button>
                ))}
              </div>
            </div>

            {/* ROW 2: sinh | cosh | tanh | Exp | ( | ) | ← (Red) | C (Red) | +/- (Red) | √ */}
            <div className="grid grid-cols-10 gap-1 text-xs">
              <button
                type="button"
                onClick={() => handleScientific('sinh')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                sinh
              </button>
              <button
                type="button"
                onClick={() => handleScientific('cosh')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                cosh
              </button>
              <button
                type="button"
                onClick={() => handleScientific('tanh')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                tanh
              </button>
              <button
                type="button"
                onClick={() => handleOperator('Exp')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                Exp
              </button>
              <button
                type="button"
                onClick={() => inputDigit('(')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                (
              </button>
              <button
                type="button"
                onClick={() => inputDigit(')')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                )
              </button>
              <button
                type="button"
                onClick={backspace}
                className="h-8 bg-[#f44336] hover:bg-[#e53935] active:bg-[#c62828] text-white border border-[#b71c1c] rounded-sm font-bold text-sm shadow-xs flex items-center justify-center"
                title="Backspace"
              >
                ←
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="h-8 bg-[#f44336] hover:bg-[#e53935] active:bg-[#c62828] text-white border border-[#b71c1c] rounded-sm font-bold text-sm shadow-xs"
                title="Clear"
              >
                C
              </button>
              <button
                type="button"
                onClick={toggleSign}
                className="h-8 bg-[#f44336] hover:bg-[#e53935] active:bg-[#c62828] text-white border border-[#b71c1c] rounded-sm font-bold text-sm shadow-xs"
                title="Change Sign"
              >
                +/-
              </button>
              <button
                type="button"
                onClick={() => handleScientific('√')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                √
              </button>
            </div>

            {/* ROW 3: sinh⁻¹ | cosh⁻¹ | tanh⁻¹ | log₂x | ln | log | 7 | 8 | 9 | / | % */}
            <div className="grid grid-cols-11 gap-1 text-xs">
              <button
                type="button"
                onClick={() => handleScientific('asinh')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800 text-[11px]"
              >
                sinh⁻¹
              </button>
              <button
                type="button"
                onClick={() => handleScientific('acosh')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800 text-[11px]"
              >
                cosh⁻¹
              </button>
              <button
                type="button"
                onClick={() => handleScientific('atanh')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800 text-[11px]"
              >
                tanh⁻¹
              </button>
              <button
                type="button"
                onClick={() => handleScientific('log2')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                log₂x
              </button>
              <button
                type="button"
                onClick={() => handleScientific('ln')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                ln
              </button>
              <button
                type="button"
                onClick={() => handleScientific('log')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                log
              </button>
              <button
                type="button"
                onClick={() => inputDigit('7')}
                className="h-8 bg-[#fafafa] hover:bg-[#ececec] border border-[#a9a9a9] rounded-sm font-bold text-slate-900 text-sm shadow-xs"
              >
                7
              </button>
              <button
                type="button"
                onClick={() => inputDigit('8')}
                className="h-8 bg-[#fafafa] hover:bg-[#ececec] border border-[#a9a9a9] rounded-sm font-bold text-slate-900 text-sm shadow-xs"
              >
                8
              </button>
              <button
                type="button"
                onClick={() => inputDigit('9')}
                className="h-8 bg-[#fafafa] hover:bg-[#ececec] border border-[#a9a9a9] rounded-sm font-bold text-slate-900 text-sm shadow-xs"
              >
                9
              </button>
              <button
                type="button"
                onClick={() => handleOperator('/')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-bold text-slate-800"
              >
                /
              </button>
              <button
                type="button"
                onClick={() => handleScientific('%')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                %
              </button>
            </div>

            {/* ROW 4: π | e | n! | logyx | eˣ | 10ˣ | 4 | 5 | 6 | * | 1/x */}
            <div className="grid grid-cols-11 gap-1 text-xs">
              <button
                type="button"
                onClick={() => handleConstant('π')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                π
              </button>
              <button
                type="button"
                onClick={() => handleConstant('e')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                e
              </button>
              <button
                type="button"
                onClick={() => handleScientific('n!')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                n!
              </button>
              <button
                type="button"
                onClick={() => handleOperator('logyx')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800 text-[11px]"
              >
                logyx
              </button>
              <button
                type="button"
                onClick={() => handleScientific('eˣ')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                eˣ
              </button>
              <button
                type="button"
                onClick={() => handleScientific('10ˣ')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                10ˣ
              </button>
              <button
                type="button"
                onClick={() => inputDigit('4')}
                className="h-8 bg-[#fafafa] hover:bg-[#ececec] border border-[#a9a9a9] rounded-sm font-bold text-slate-900 text-sm shadow-xs"
              >
                4
              </button>
              <button
                type="button"
                onClick={() => inputDigit('5')}
                className="h-8 bg-[#fafafa] hover:bg-[#ececec] border border-[#a9a9a9] rounded-sm font-bold text-slate-900 text-sm shadow-xs"
              >
                5
              </button>
              <button
                type="button"
                onClick={() => inputDigit('6')}
                className="h-8 bg-[#fafafa] hover:bg-[#ececec] border border-[#a9a9a9] rounded-sm font-bold text-slate-900 text-sm shadow-xs"
              >
                6
              </button>
              <button
                type="button"
                onClick={() => handleOperator('*')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-bold text-slate-800"
              >
                *
              </button>
              <button
                type="button"
                onClick={() => handleScientific('1/x')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                1/x
              </button>
            </div>

            {/* ROW 5 & 6 (with tall Green '=' button) */}
            <div className="grid grid-cols-11 gap-1 text-xs">
              {/* Row 5 left 10 cols */}
              <button
                type="button"
                onClick={() => handleScientific('sin')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                sin
              </button>
              <button
                type="button"
                onClick={() => handleScientific('cos')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                cos
              </button>
              <button
                type="button"
                onClick={() => handleScientific('tan')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                tan
              </button>
              <button
                type="button"
                onClick={() => handleOperator('xʸ')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                xʸ
              </button>
              <button
                type="button"
                onClick={() => handleScientific('x³')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                x³
              </button>
              <button
                type="button"
                onClick={() => handleScientific('x²')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                x²
              </button>
              <button
                type="button"
                onClick={() => inputDigit('1')}
                className="h-8 bg-[#fafafa] hover:bg-[#ececec] border border-[#a9a9a9] rounded-sm font-bold text-slate-900 text-sm shadow-xs"
              >
                1
              </button>
              <button
                type="button"
                onClick={() => inputDigit('2')}
                className="h-8 bg-[#fafafa] hover:bg-[#ececec] border border-[#a9a9a9] rounded-sm font-bold text-slate-900 text-sm shadow-xs"
              >
                2
              </button>
              <button
                type="button"
                onClick={() => inputDigit('3')}
                className="h-8 bg-[#fafafa] hover:bg-[#ececec] border border-[#a9a9a9] rounded-sm font-bold text-slate-900 text-sm shadow-xs"
              >
                3
              </button>
              <button
                type="button"
                onClick={() => handleOperator('-')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-bold text-slate-800"
              >
                -
              </button>

              {/* TALL GREEN EQUALS BUTTON: spans row 5 and row 6 */}
              <button
                type="button"
                onClick={handleEquals}
                className="row-span-2 h-[70px] bg-[#22c55e] hover:bg-[#16a34a] active:bg-[#15803d] text-white font-bold text-xl rounded-sm border border-[#15803d] shadow-sm flex items-center justify-center transition"
                title="Calculate"
              >
                =
              </button>

              {/* Row 6 left 10 cols */}
              <button
                type="button"
                onClick={() => handleScientific('asin')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800 text-[11px]"
              >
                sin⁻¹
              </button>
              <button
                type="button"
                onClick={() => handleScientific('acos')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800 text-[11px]"
              >
                cos⁻¹
              </button>
              <button
                type="button"
                onClick={() => handleScientific('atan')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800 text-[11px]"
              >
                tan⁻¹
              </button>
              <button
                type="button"
                onClick={() => handleOperator('ʸ√x')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800 text-[11px]"
              >
                ʸ√x
              </button>
              <button
                type="button"
                onClick={() => handleScientific('∛x')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800 text-[11px]"
              >
                ∛x
              </button>
              <button
                type="button"
                onClick={() => handleScientific('|x|')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-medium text-slate-800"
              >
                |x|
              </button>
              {/* 0 button spans 2 columns */}
              <button
                type="button"
                onClick={() => inputDigit('0')}
                className="col-span-2 h-8 bg-[#fafafa] hover:bg-[#ececec] border border-[#a9a9a9] rounded-sm font-bold text-slate-900 text-sm shadow-xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={inputDot}
                className="h-8 bg-[#fafafa] hover:bg-[#ececec] border border-[#a9a9a9] rounded-sm font-bold text-slate-900 text-sm shadow-xs"
              >
                .
              </button>
              <button
                type="button"
                onClick={() => handleOperator('+')}
                className="h-8 bg-[#f5f5f5] hover:bg-[#eaeaea] border border-[#a9a9a9] rounded-sm font-bold text-slate-800"
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
