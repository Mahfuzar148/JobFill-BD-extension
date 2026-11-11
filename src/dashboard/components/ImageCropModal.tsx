import React, { useEffect, useRef, useState } from 'react';
import { Scissors, Sparkles, X, ZoomIn, RotateCcw } from 'lucide-react';
import { ImageProcessor, ProcessedImageResult } from '../../services/image-processor';

interface ImageCropModalProps {
  title: string;
  category: 'photo' | 'signature';
  sourceDataUrl: string;
  targetWidth: number;
  targetHeight: number;
  defaultMaxKb: number;
  language?: 'bn' | 'en';
  onApply: (result: ProcessedImageResult) => Promise<void>;
  onClose: () => void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  title,
  category,
  sourceDataUrl,
  targetWidth,
  targetHeight,
  defaultMaxKb,
  language = 'en',
  onApply,
  onClose,
}) => {
  const bn = language === 'bn';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgSize, setImgSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0); // -1 .. +1 normalized
  const [panY, setPanY] = useState(0); // -1 .. +1 normalized
  const [maxKb, setMaxKb] = useState(defaultMaxKb);
  const [cleanBg, setCleanBg] = useState(category === 'signature');
  const [cleanThreshold, setCleanThreshold] = useState(195);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth || targetWidth, h: img.naturalHeight || targetHeight });
    };
    img.src = sourceDataUrl;
  }, [sourceDataUrl, targetWidth, targetHeight]);

  const computeCropRect = () => {
    const natW = imgSize.w || targetWidth;
    const natH = imgSize.h || targetHeight;
    const targetRatio = targetWidth / targetHeight;
    const srcRatio = natW / natH;

    let baseW = natW;
    let baseH = natH;
    if (srcRatio > targetRatio) {
      baseW = natH * targetRatio;
    } else {
      baseH = natW / targetRatio;
    }

    const cropW = Math.max(10, baseW / zoom);
    const cropH = Math.max(10, baseH / zoom);
    const maxOffsetX = Math.max(0, (natW - cropW) / 2);
    const maxOffsetY = Math.max(0, (natH - cropH) / 2);

    const cx = natW / 2 + panX * maxOffsetX;
    const cy = natH / 2 + panY * maxOffsetY;

    return {
      x: Math.max(0, Math.min(natW - cropW, cx - cropW / 2)),
      y: Math.max(0, Math.min(natH - cropH, cy - cropH / 2)),
      width: cropW,
      height: cropH,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || imgSize.w === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = computeCropRect();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, targetWidth, targetHeight);

    if (cleanBg) {
      const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      ImageProcessor.cleanSignaturePixels(imgData.data, cleanThreshold);
      ctx.putImageData(imgData, 0, 0);
    }
  }, [imgSize, zoom, panX, panY, cleanBg, cleanThreshold, targetWidth, targetHeight]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await ImageProcessor.processWithOptions(sourceDataUrl, {
        targetWidth,
        targetHeight,
        maxSizeKb: maxKb,
        outputFormat: 'image/jpeg',
        cropRect: computeCropRect(),
        cleanSignatureBackground: cleanBg,
        cleanThreshold,
      });
      await onApply(result);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-petro-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Scissors className="w-4 h-4" />
            <span>{title}</span>
          </div>
          <button type="button" onClick={onClose} className="hover:bg-white/15 rounded-lg p-1 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <div className="flex flex-col items-center gap-2">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl border-2 border-dashed border-petro-300">
              <canvas
                ref={canvasRef}
                width={targetWidth}
                height={targetHeight}
                className="bg-white rounded shadow-sm max-w-full"
                style={{
                  width: category === 'photo' ? 210 : 300,
                  height: category === 'photo' ? 210 : 80,
                }}
              />
            </div>
            <div className="text-[11px] text-slate-500">
              {targetWidth} × {targetHeight} px • ≤ {maxKb} KB JPEG
            </div>
          </div>

          <div className="space-y-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span className="inline-flex items-center gap-1"><ZoomIn className="w-3.5 h-3.5" /> {bn ? 'জুম (Zoom)' : 'Zoom'}</span>
                <span>{zoom.toFixed(2)}×</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-petro-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <span>{bn ? 'আড়াআড়ি সরান (X)' : 'Pan Horizontal'}</span>
                  <span>{Math.round(panX * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={panX}
                  onChange={(e) => setPanX(Number(e.target.value))}
                  className="w-full accent-petro-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <span>{bn ? 'লম্বালম্বি সরান (Y)' : 'Pan Vertical'}</span>
                  <span>{Math.round(panY * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.05"
                  value={panY}
                  onChange={(e) => setPanY(Number(e.target.value))}
                  className="w-full accent-petro-600"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <span>{bn ? 'সর্বোচ্চ সাইজ সীমা (Max KB)' : 'Max Target File Size'}</span>
                <span>{maxKb} KB</span>
              </div>
              <input
                type="range"
                min="20"
                max="150"
                step="5"
                value={maxKb}
                onChange={(e) => setMaxKb(Number(e.target.value))}
                className="w-full accent-petro-600"
              />
            </div>

            <div className="pt-1 border-t border-slate-200 dark:border-slate-700 space-y-2">
              <label className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanBg}
                  onChange={(e) => setCleanBg(e.target.checked)}
                  className="accent-petro-600"
                />
                <span>
                  {bn
                    ? 'সাদা কাগজের ছায়া পরিষ্কার করুন (Signature / Document Clean)'
                    : 'Clean White Paper Background Shadows'}
                </span>
              </label>

              {cleanBg && (
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>{bn ? 'থ্রেশহোল্ড (White Threshold)' : 'Clean Sensitivity'}</span>
                    <span>{cleanThreshold}</span>
                  </div>
                  <input
                    type="range"
                    min="145"
                    max="235"
                    step="5"
                    value={cleanThreshold}
                    onChange={(e) => setCleanThreshold(Number(e.target.value))}
                    className="w-full accent-petro-600"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPanX(0);
                setPanY(0);
              }}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{bn ? 'রিসেট' : 'Reset'}</span>
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-petro-600 hover:bg-petro-700 text-white font-bold shadow cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{saving ? 'Processing...' : bn ? 'ক্রপ কপি সেভ করুন' : 'Save Cropped Copy'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
