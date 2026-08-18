'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Navigation, Search, MapPin, X, LoaderCircle } from 'lucide-react';
import {
  requestBrowserLocation, reverseGeocode, geocodeSearch, GeoResult, PRESET_AREAS,
} from '@/lib/ddgoLocation';

/**
 * Zomato-style "where should we deliver" picker.
 *
 * GPS is offered first, but never the only way in: inside the Android WebView
 * geolocation is often unavailable, so search (OpenStreetMap) and a few presets
 * let anyone set a location by name. Returns { lat, lng, label } to the caller.
 */
export default function LocationPicker({
  onPick, onClose,
}: {
  onPick: (loc: { lat: number; lng: number; label: string }) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) { setResults([]); return; }
    setSearching(true);
    timer.current = setTimeout(async () => {
      setResults(await geocodeSearch(q));
      setSearching(false);
    }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const useGps = async () => {
    setLocating(true); setError('');
    try {
      const { lat, lng } = await requestBrowserLocation();
      const label = (await reverseGeocode(lat, lng)) || 'Current location';
      onPick({ lat, lng, label });
    } catch (e: any) {
      setError(e?.message || 'Could not get your location. Search for your area instead.');
    }
    setLocating(false);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/45 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100">
          <h2 className="text-[16px] font-extrabold text-gray-900">Select delivery location</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700"><X size={20} /></button>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
            <Search size={16} className="text-gray-400 shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search for area, street name…"
              className="flex-1 bg-transparent outline-none text-[14px] text-gray-800 placeholder-gray-400"
            />
            {q && <button onClick={() => setQ('')} className="text-gray-400"><X size={15} /></button>}
          </div>

          <button
            onClick={useGps}
            disabled={locating}
            className="w-full mt-3 flex items-center gap-2.5 text-[#0D7A30] font-bold text-[13.5px] py-2"
          >
            {locating ? <LoaderCircle size={17} className="animate-spin" /> : <Navigation size={17} />}
            {locating ? 'Getting your location…' : 'Use my current location'}
          </button>
          {error && <p className="text-[12px] text-red-500 -mt-1 mb-1">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {searching && (
            <p className="px-2 py-3 text-[12.5px] text-gray-400 flex items-center gap-2">
              <LoaderCircle size={14} className="animate-spin" /> Searching…
            </p>
          )}

          {!searching && results.length > 0 && results.map((r, i) => (
            <Row key={`s${i}`} label={r.label} onClick={() => onPick(r)} />
          ))}

          {!q && (
            <>
              <p className="px-3 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">Popular areas</p>
              {PRESET_AREAS.map((r, i) => (
                <Row key={`p${i}`} label={r.label} onClick={() => onPick(r)} />
              ))}
            </>
          )}

          {!searching && q.trim().length >= 3 && results.length === 0 && (
            <p className="px-3 py-4 text-[13px] text-gray-400 text-center">No matches. Try a nearby landmark or area.</p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Row({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-left transition"
    >
      <MapPin size={16} className="text-gray-400 shrink-0 mt-0.5" />
      <span className="text-[13.5px] text-gray-800 leading-snug">{label}</span>
    </button>
  );
}
