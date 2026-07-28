'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { getRegion } from '@/lib/api';
import { statesFor } from '@/lib/states';
import { MapPin, LocateFixed, X, Check, Globe2 } from 'lucide-react';

export interface Loc { state: string; city: string; lat: number | null; lng: number | null; radius: number }
const EMPTY: Loc = { state: '', city: '', lat: null, lng: null, radius: 25 };

interface LocCtx {
  loc: Loc;
  label: string;
  openPicker: () => void;
  setLoc: (l: Loc) => void;
}
const Ctx = createContext<LocCtx>({} as LocCtx);
export const useLoc = () => useContext(Ctx);

/* Cookies let SSR (home/browse) filter by the chosen location. */
function writeCookies(l: Loc) {
  const set = (k: string, v: string) =>
    (document.cookie = `${k}=${encodeURIComponent(v)}; path=/; max-age=31536000; SameSite=Lax`);
  set('dd_state', l.state || '');
  set('dd_lat', l.lat != null ? String(l.lat) : '');
  set('dd_lng', l.lng != null ? String(l.lng) : '');
  set('dd_rad', String(l.radius || 25));
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [loc, setLocState] = useState<Loc>(EMPTY);
  const [show, setShow] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const saved = localStorage.getItem('dd_loc');
      if (saved) { setLocState({ ...EMPTY, ...JSON.parse(saved) }); return; }
    } catch {}
    // First visit — best-effort auto-detect from IP (user can change anytime)
    fetch('/proxy-api/coupons/geo')
      .then((r) => r.json())
      .then((g) => {
        if (g?.found && g.state) {
          const auto: Loc = { ...EMPTY, state: g.state, city: g.city || '' };
          setLocState(auto);
          localStorage.setItem('dd_loc', JSON.stringify(auto));
          writeCookies(auto);
          router.refresh();
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLoc = useCallback((l: Loc) => {
    setLocState(l);
    localStorage.setItem('dd_loc', JSON.stringify(l));
    writeCookies(l);
    router.refresh(); // re-render SSR pages with new cookies
  }, [router]);

  const label = loc.lat != null ? `Near me · ${loc.radius} km` : loc.state ? (loc.city ? `${loc.city}, ${loc.state}` : loc.state) : '';

  return (
    <Ctx.Provider value={{ loc, label, openPicker: () => setShow(true), setLoc }}>
      {children}
      {show && <Picker loc={loc} onSave={(l) => { setLoc(l); setShow(false); }} onClose={() => setShow(false)} />}
    </Ctx.Provider>
  );
}

/* ── Header pill ── */
export function LocationPill({ compact = false }: { compact?: boolean }) {
  const { label, openPicker } = useLoc();
  return (
    <button onClick={openPicker}
      className={`flex items-center gap-1.5 shrink-0 font-bold text-primary bg-primary-light/70 hover:bg-primary-light rounded-full transition ${compact ? 'text-[11.5px] px-3 py-2' : 'text-[12.5px] px-3.5 py-2'}`}>
      <MapPin size={compact ? 13 : 14} className="shrink-0" />
      <span className="truncate max-w-[110px]">{label || 'Location'}</span>
    </button>
  );
}

/* ── Picker modal ── */
function Picker({ loc, onSave, onClose }: { loc: Loc; onSave: (l: Loc) => void; onClose: () => void }) {
  const region = getRegion();
  const states = statesFor(region);
  const [draft, setDraft] = useState<Loc>(loc);
  const [locating, setLocating] = useState(false);
  const [geoErr, setGeoErr] = useState('');

  const useMyLocation = () => {
    setLocating(true); setGeoErr('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft((d) => ({ ...d, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        setLocating(false);
      },
      () => { setGeoErr('Location access denied — pick your state instead.'); setLocating(false); },
      { timeout: 8000 }
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:px-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md p-6 pop-in max-h-[85vh] overflow-y-auto">
        <div className="absolute top-0 left-0 right-0 h-1.5 brand-grad rounded-t-3xl" />
        <button onClick={onClose} className="absolute top-3.5 right-3.5 p-1 text-gray-400"><X size={18} /></button>
        <h3 className="font-extrabold text-[18px] text-ink flex items-center gap-2"><MapPin size={18} className="text-primary" /> Choose your location</h3>
        <p className="text-[12px] text-gray-400 mt-0.5 mb-4">Local offers (doctors, salons, shops) show only for your area.</p>

        {/* Near me */}
        <button onClick={useMyLocation} disabled={locating}
          className="w-full flex items-center gap-3 bg-band rounded-2xl px-4 py-3.5 hover:bg-primary-light transition text-left">
          <span className="w-9 h-9 rounded-xl brand-grad grid place-items-center text-white shrink-0"><LocateFixed size={17} /></span>
          <span className="flex-1">
            <span className="block text-[14px] font-extrabold text-ink">{locating ? 'Locating…' : 'Use my current location'}</span>
            <span className="block text-[11.5px] text-gray-400">Shows offers within your chosen radius</span>
          </span>
          {draft.lat != null && <Check size={18} className="text-emerald-500" />}
        </button>
        {geoErr && <p className="text-[11.5px] text-red-500 mt-1.5">{geoErr}</p>}

        {draft.lat != null && (
          <div className="mt-3 px-1">
            <label className="text-[12px] font-bold text-gray-500">Radius: <span className="text-primary">{draft.radius} km</span></label>
            <input type="range" min={5} max={100} step={5} value={draft.radius}
              onChange={(e) => setDraft((d) => ({ ...d, radius: parseInt(e.target.value) }))}
              className="w-full accent-[#7C3AED]" />
          </div>
        )}

        <div className="flex items-center gap-3 my-4">
          <span className="flex-1 h-px bg-gray-100" /><span className="text-[11px] font-bold text-gray-300">OR</span><span className="flex-1 h-px bg-gray-100" />
        </div>

        {/* State + city */}
        <label className="text-[12px] font-bold text-gray-500">State</label>
        <select value={draft.state}
          onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value, lat: null, lng: null }))}
          className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary">
          <option value="">— Select state —</option>
          {states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="text-[12px] font-bold text-gray-500 mt-3 block">City (optional)</label>
        <input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
          placeholder="e.g. Patiala"
          className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-primary" />

        <div className="flex gap-2.5 mt-5">
          <button onClick={() => onSave(EMPTY)}
            className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-bold text-[13px] hover:border-primary">
            <Globe2 size={15} /> All {region === 'US' ? 'USA' : 'India'}
          </button>
          <button onClick={() => onSave(draft)} className="btn-claim flex-[1.4] py-3 text-[14px]">
            <span className="relative z-10">Apply location</span>
          </button>
        </div>
      </div>
    </div>
  );
}
