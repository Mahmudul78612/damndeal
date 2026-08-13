'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Check, X, ZoomIn, RotateCcw } from 'lucide-react';

/**
 * Pick → crop → upload, with the output size fixed by the caller.
 *
 * The same photo cannot look right as a wide hero band and as a 3:4 tile, so
 * each slot crops to its own ratio and uploads a correctly-sized file rather
 * than letting CSS object-cover guess. The crop happens in a canvas in the
 * browser: no library, and the server receives an image that is already the
 * right shape and weight.
 */
export interface CropSpec {
  /** Output width in pixels — also fixes the aspect ratio with height. */
  width: number;
  height: number;
  label: string;
  hint: string;
}

export default function ImageCropUpload({
  value,
  spec,
  onUploaded,
  upload,
  imgSrc,
}: {
  value?: string;
  spec: CropSpec;
  onUploaded: (path: string) => void;
  /** Injected so this works with either the shopper or the business client. */
  upload: (fd: FormData) => Promise<{ files?: string[] }>;
  imgSrc: (p?: string) => string;
}) {
  const ratio = spec.width / spec.height;

  const [file, setFile] = useState<File | null>(null);
  const [imgUrl, setImgUrl] = useState('');
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => () => { if (imgUrl) URL.revokeObjectURL(imgUrl); }, [imgUrl]);

  const pick = (f?: File | null) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (f.size > 12 * 1024 * 1024) { setError('That image is over 12 MB — pick a smaller one.'); return; }
    setError('');
    setZoom(1); setOffset({ x: 0, y: 0 });
    setFile(f);
    setImgUrl(URL.createObjectURL(f));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    });
  };
  const onPointerUp = () => { drag.current = null; };

  /** Render exactly what the frame shows into a canvas at the target size. */
  const confirm = useCallback(async () => {
    const frame = frameRef.current;
    const img = imgRef.current;
    if (!frame || !img || !file) return;

    setBusy(true); setError('');
    try {
      const fw = frame.clientWidth;
      const fh = frame.clientHeight;

      // The <img> is rendered with object-fit: contain at base scale, then
      // scaled by `zoom` and shifted by `offset`. Recreate that mapping.
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const base = Math.max(fw / natW, fh / natH); // cover the frame
      const scale = base * zoom;
      const drawW = natW * scale;
      const drawH = natH * scale;
      const drawX = (fw - drawW) / 2 + offset.x;
      const drawY = (fh - drawH) / 2 + offset.y;

      const canvas = document.createElement('canvas');
      canvas.width = spec.width;
      canvas.height = spec.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const k = spec.width / fw; // frame px → output px
      ctx.drawImage(img, drawX * k, drawY * k, drawW * k, drawH * k);

      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image'))), 'image/jpeg', 0.9)
      );

      const fd = new FormData();
      fd.append('images', new File([blob], `crop-${spec.width}x${spec.height}.jpg`, { type: 'image/jpeg' }));
      const r = await upload(fd);
      if (!r.files?.[0]) throw new Error('Upload failed — please try again');
      onUploaded(r.files[0]);
      setFile(null);
      setImgUrl('');
    } catch (e) {
      setError((e as Error).message || 'Could not upload');
    }
    setBusy(false);
  }, [file, zoom, offset, spec, upload, onUploaded]);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <label className="text-[12px] font-bold text-gray-500">{spec.label}</label>
        <span className="text-[11px] font-bold text-primary tabular-nums">
          {spec.width} × {spec.height}
        </span>
      </div>
      <p className="text-[11.5px] text-gray-400 mb-2">{spec.hint}</p>

      {/* Current image / empty state */}
      {!file && (
        <label className="block cursor-pointer">
          <div
            className="relative rounded-xl overflow-hidden border-2 border-dashed border-gray-300 hover:border-primary transition bg-gray-50"
            style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
          >
            {value ? (
              <>
                <img src={imgSrc(value)} alt={spec.label} className="w-full h-full object-cover" />
                <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                  Change
                </span>
              </>
            ) : (
              <span className="absolute inset-0 grid place-items-center text-center px-4">
                <span>
                  <Upload size={20} className="mx-auto text-gray-400 mb-1.5" />
                  <span className="block text-[12.5px] font-bold text-gray-500">Choose an image</span>
                  <span className="block text-[11px] text-gray-400 mt-0.5">You can crop it to fit</span>
                </span>
              </span>
            )}
          </div>
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => pick(e.target.files?.[0])} />
        </label>
      )}

      {/* Cropper */}
      {file && (
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative w-full overflow-hidden rounded-lg bg-[#111] cursor-grab active:cursor-grabbing touch-none select-none"
            style={{ aspectRatio: `${spec.width} / ${spec.height}` }}
          >
            {imgUrl && (
              <img
                ref={imgRef}
                src={imgUrl}
                alt="crop"
                draggable={false}
                className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
                style={{
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
            {/* Rule-of-thirds guides make it obvious this is a crop frame */}
            <div className="pointer-events-none absolute inset-0 opacity-40">
              <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/60" />
              <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/60" />
              <div className="absolute top-1/3 left-0 right-0 h-px bg-white/60" />
              <div className="absolute top-2/3 left-0 right-0 h-px bg-white/60" />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <ZoomIn size={15} className="text-gray-400 shrink-0" />
            <input type="range" min={1} max={3} step={0.01} value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-[#7C3AED]" />
            <button type="button" onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
              className="p-1.5 text-gray-400 hover:text-primary" title="Reset">
              <RotateCcw size={15} />
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Drag the image to position it, and zoom to fill the frame.</p>

          <div className="flex gap-2 mt-3">
            <button type="button" onClick={() => { setFile(null); setImgUrl(''); }}
              className="flex-1 py-2 rounded-lg border border-gray-200 font-bold text-[13px] text-gray-500 flex items-center justify-center gap-1.5">
              <X size={14} /> Cancel
            </button>
            <button type="button" onClick={confirm} disabled={busy}
              className="btn-claim flex-1 py-2 text-[13px] disabled:opacity-50">
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                <Check size={14} /> {busy ? 'Uploading…' : 'Use this crop'}
              </span>
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-[12px] mt-2">{error}</p>}
    </div>
  );
}

/** The two shapes a coupon is shown in. Kept here so every form agrees. */
export const COUPON_IMAGE_SPECS: Record<'banner' | 'tile', CropSpec> = {
  banner: {
    width: 1200,
    height: 450,
    label: 'Wide banner',
    hint: 'Shown on coupon cards, list rows and the top of the coupon page.',
  },
  tile: {
    width: 900,
    height: 1200,
    label: 'Tall tile (3:4)',
    hint: 'Shown in the poster-style tile grid, the spin wheel and showcases.',
  },
};
