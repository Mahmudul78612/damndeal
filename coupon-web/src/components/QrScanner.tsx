'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Camera, Zap, ZapOff, SwitchCamera, Keyboard } from 'lucide-react';

/**
 * Camera QR scanner for redeeming a customer's coupon at the counter.
 *
 * Decoding uses the browser's native BarcodeDetector where it exists (Chrome
 * and Android WebView — no main-thread cost) and falls back to jsQR everywhere
 * else, notably Safari and iOS. jsQR is imported lazily so the ~40KB only
 * loads when someone actually opens the scanner.
 *
 * Rendered through a portal: the merchant console has a backdrop-blurred
 * sticky bar, and blur creates a containing block that would otherwise trap a
 * position:fixed overlay inside it.
 */

/** Customer QRs carry the bare code, but a link form is accepted too. */
function extractCode(raw: string): string {
  const text = (raw || '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) {
    try {
      const u = new URL(text);
      const q = u.searchParams.get('code') || u.searchParams.get('c');
      if (q) return q.trim().toUpperCase();
      const last = u.pathname.split('/').filter(Boolean).pop();
      if (last) return decodeURIComponent(last).trim().toUpperCase();
    } catch {
      /* fall through to the raw value */
    }
  }
  return text.toUpperCase();
}

export default function QrScanner({
  onDetect,
  onClose,
  title = 'Scan customer QR',
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const [error, setError] = useState('');
  const [starting, setStarting] = useState(true);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [manual, setManual] = useState('');

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const finish = useCallback(
    (raw: string) => {
      const code = extractCode(raw);
      if (!code || doneRef.current) return;
      doneRef.current = true;
      if (navigator.vibrate) navigator.vibrate(40);
      stop();
      onDetect(code);
    },
    [onDetect, stop]
  );

  useEffect(() => {
    let cancelled = false;
    doneRef.current = false;

    (async () => {
      setStarting(true);
      setError('');

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot open the camera. Type the code instead.');
        setStarting(false);
        return;
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e: any) {
        const name = e?.name || '';
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was blocked. Allow it in your browser settings, or type the code below.'
            : name === 'NotFoundError'
              ? 'No camera found on this device. Type the code below.'
              : 'Could not start the camera. Type the code below.'
        );
        setStarting(false);
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      setHasTorch(!!(track?.getCapabilities?.() as any)?.torch);

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* autoplay rejection still leaves usable frames on most browsers */
      }
      setStarting(false);

      // Native path first — no per-frame pixel copying when it exists.
      const Detector = (window as any).BarcodeDetector;
      let detector: any = null;
      if (Detector) {
        try {
          detector = new Detector({ formats: ['qr_code'] });
        } catch {
          detector = null;
        }
      }
      const jsQR = detector ? null : (await import('jsqr')).default;

      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

      const tick = async () => {
        if (cancelled || doneRef.current) return;
        if (video.readyState === video.HAVE_ENOUGH_DATA) {
          try {
            if (detector) {
              const found = await detector.detect(video);
              if (found?.length) return finish(found[0].rawValue || '');
            } else if (jsQR) {
              // Downscale before decoding: a 480px-wide frame reads a phone
              // screen fine and keeps the loop smooth on cheap counter devices.
              const w = 480;
              const h = Math.round((video.videoHeight / video.videoWidth) * w) || 360;
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(video, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              const res = jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
              if (res?.data) return finish(res.data);
            }
          } catch {
            /* a bad frame is not worth stopping the loop for */
          }
        }
        rafRef.current = requestAnimationFrame(() => { void tick(); });
      };

      rafRef.current = requestAnimationFrame(() => { void tick(); });
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, finish, stop]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] } as any);
      setTorchOn((v) => !v);
    } catch {
      setHasTorch(false);
    }
  };

  const close = () => { stop(); onClose(); };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
        <p className="font-extrabold text-[15px]">{title}</p>
        <div className="flex items-center gap-1">
          {hasTorch && (
            <button onClick={toggleTorch} aria-label="Toggle flash" className="p-2 rounded-full hover:bg-white/10">
              {torchOn ? <ZapOff size={20} /> : <Zap size={20} />}
            </button>
          )}
          <button
            onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
            aria-label="Switch camera"
            className="p-2 rounded-full hover:bg-white/10"
          >
            <SwitchCamera size={20} />
          </button>
          <button onClick={close} aria-label="Close scanner" className="p-2 rounded-full hover:bg-white/10">
            <X size={22} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <video ref={videoRef} playsInline muted autoPlay className="w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {/* Aiming frame */}
        {!error && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="w-[62vw] max-w-[300px] aspect-square rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(0,0,0,.45)]" />
          </div>
        )}

        {starting && !error && (
          <p className="absolute inset-x-0 bottom-6 text-center text-white/80 text-[13px] flex items-center justify-center gap-2">
            <Camera size={15} /> Starting camera…
          </p>
        )}
        {!starting && !error && (
          <p className="absolute inset-x-0 bottom-6 text-center text-white/80 text-[13px]">
            Point at the QR on the customer&apos;s screen
          </p>
        )}
      </div>

      {/* Manual entry always stays reachable — counters lose camera permission,
          crack lenses, and serve customers whose screen is too dim to read. */}
      <div className="shrink-0 bg-white px-4 py-3 rounded-t-2xl">
        {error && <p className="text-[12.5px] text-red-600 font-semibold mb-2">{error}</p>}
        <label className="flex items-center gap-1.5 text-[12px] font-bold text-gray-500 mb-1.5">
          <Keyboard size={14} /> Or type the code
        </label>
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && manual.trim().length >= 6 && finish(manual)}
            placeholder="DD-XXXX-XXXX"
            className="flex-1 min-w-0 px-3 py-2.5 rounded-lg border border-gray-200 font-mono font-bold tracking-wider text-[15px] outline-none focus:border-primary"
          />
          <button
            onClick={() => finish(manual)}
            disabled={manual.trim().length < 6}
            className="px-5 rounded-lg bg-primary text-white font-bold text-sm disabled:opacity-40"
          >
            Check
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
