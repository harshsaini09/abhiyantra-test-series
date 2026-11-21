import { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

export default function ImageLightbox({ src, alt = 'Question Visual', onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);

  // Close on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));
  const resetZoom = () => setScale(1);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Lightbox Toolbar */}
      <div
        className="absolute top-4 right-4 flex items-center gap-2 bg-slate-900/90 text-white rounded-xl p-1.5 shadow-lg border border-slate-700 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={zoomIn}
          title="Zoom In"
          className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition"
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={zoomOut}
          title="Zoom Out"
          className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition"
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <button
          onClick={resetZoom}
          title="Reset Zoom"
          className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
        <div className="w-px h-6 bg-slate-700 mx-1" />
        <button
          onClick={onClose}
          title="Close Lightbox"
          className="p-2 bg-red-600/80 hover:bg-red-600 rounded-lg text-white transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image container */}
      <div
        className="max-w-4xl max-h-[85vh] overflow-auto rounded-2xl flex items-center justify-center p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          style={{ transform: `scale(${scale})`, transition: 'transform 0.15s ease-out' }}
          className="max-h-[80vh] w-auto max-w-full object-contain rounded-xl shadow-2xl select-none"
        />
      </div>
    </div>
  );
}

export function QuestionImage({ src, alt = 'Question diagram', caption }: { src: string; alt?: string; caption?: string }) {
  const [open, setOpen] = useState(false);

  if (!src) return null;

  return (
    <>
      <div className="my-3 group relative inline-block max-w-full">
        <div
          onClick={() => setOpen(true)}
          className="cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all inline-block max-w-full"
        >
          <img
            src={src}
            alt={alt}
            className="max-h-72 w-auto max-w-full object-contain rounded-lg"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl transition-all flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100">
            <span className="bg-slate-900/80 text-white text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 backdrop-blur-xs">
              <Maximize2 className="w-3.5 h-3.5" />
              Click to Zoom
            </span>
          </div>
        </div>
        {caption && (
          <p className="text-xs text-slate-500 mt-1 italic text-center">{caption}</p>
        )}
      </div>

      {open && <ImageLightbox src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
}
