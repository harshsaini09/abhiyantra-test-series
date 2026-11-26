import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Trash2, Check, Loader2, ExternalLink } from 'lucide-react';
import { uploadDiagramApi } from '../utils/api';

interface DiagramUploaderProps {
  currentUrl?: string | null;
  onUploadSuccess: (url: string) => void;
  onRemove?: () => void;
  questionId?: number | string;
  isSolution?: boolean;
  label?: string;
  compact?: boolean;
}

export const DiagramUploader: React.FC<DiagramUploaderProps> = ({
  currentUrl,
  onUploadSuccess,
  onRemove,
  questionId,
  isSolution = false,
  label = 'Attach Diagram',
  compact = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const [storageBadge, setStorageBadge] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPreviewUrl(currentUrl || null);
  }, [currentUrl]);

  // Upload handler for File object
  const processFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file (PNG, JPG, WebP, SVG).');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError('Image file must be under 5MB.');
        return;
      }

      try {
        setUploading(true);
        setError(null);

        // Convert to base64
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            const res = await uploadDiagramApi({
              imageBase64: base64Data,
              filename: file.name,
              questionId,
              isSolution,
            });

            setPreviewUrl(res.url);
            setStorageBadge(res.storage === 'github_cdn' ? 'jsDelivr Global CDN' : 'Local Asset');
            onUploadSuccess(res.url);
          } catch (err: any) {
            setError(err.message || 'Upload failed.');
          } finally {
            setUploading(false);
          }
        };
        reader.readAsDataURL(file);
      } catch (err: any) {
        setError(err.message || 'Failed to process file.');
        setUploading(false);
      }
    },
    [questionId, isSolution, onUploadSuccess]
  );

  // Global paste handler when focused on container
  const handlePaste = useCallback(
    (e: React.ClipboardEvent | ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            const file = new File([blob], `screenshot_${Date.now()}.png`, { type: blob.type });
            processFile(file);
            return;
          }
        }
      }
    },
    [processFile]
  );

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewUrl(null);
    setStorageBadge(null);
    if (onRemove) onRemove();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      ref={containerRef}
      onPaste={handlePaste}
      tabIndex={0}
      className={`relative rounded-xl transition-all outline-hidden focus:ring-2 focus:ring-indigo-400 ${
        compact ? 'p-2 bg-slate-50 border border-slate-200' : 'p-3 bg-white border border-slate-200'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* When Diagram exists: Preview Card */}
      {previewUrl ? (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0 w-32 h-24 sm:w-36 sm:h-24 flex items-center justify-center">
            <img
              src={previewUrl}
              alt="Diagram Preview"
              className="max-w-full max-h-full object-contain"
            />
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Zoom</span>
            </a>
          </div>

          <div className="flex-1 min-w-0 space-y-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Diagram Attached
              </span>
              {storageBadge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {storageBadge}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate max-w-xs">{previewUrl}</p>

            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 cursor-pointer shadow-2xs"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleClear}
                disabled={uploading}
                className="px-2.5 py-1 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 rounded-lg cursor-pointer transition shadow-2xs flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Empty Upload Dropzone */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-3.5 sm:p-4 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-50/70'
              : 'border-slate-300 hover:border-indigo-400 bg-slate-50/70 hover:bg-white'
          }`}
        >
          {uploading ? (
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Uploading to CDN &amp; GitHub...</span>
            </div>
          ) : (
            <>
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {label}
                </p>
                <p className="text-[11px] text-slate-500">
                  Drag &amp; drop, click to browse, or paste screenshot (<kbd className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200">Ctrl+V</kbd>)
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {error && (
        <p className="mt-1.5 text-[11px] font-semibold text-red-600 text-center sm:text-left">
          {error}
        </p>
      )}
    </div>
  );
};

export default DiagramUploader;
