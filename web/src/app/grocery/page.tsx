'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api, imgUrl } from '@/lib/api';
import ProductCard from '@/components/ProductCard';
import { Category, Product } from '@/lib/types';
import {
  MapPin, Navigation, Clock, Search, ChevronRight, Store, LoaderCircle, BellRing,
} from 'lucide-react';
import {
  readLocation, saveLocation, clearLocation, requestBrowserLocation, DdgoLocation,
} from '@/lib/ddgoLocation';

/**
 * DDGo — the quick commerce storefront.
 *
 * Location first, catalogue second. A rider delivers from one shop, so until we
 * know where the customer is standing every price, ETA and in-stock badge would
 * be a guess. Showing the aisles first and refusing at checkout is exactly the
 * flow this replaces.
 */

interface ServiceStore {
  id: string;
  type: 'darkstore' | 'partner';
  name: string;
  city: string;
  distanceKm: number;
  etaMins: number;
  isOpen: boolean;
  minOrderAmount: number;
  deliveryFee: number;
  freeDeliveryAbove: number;
}

type Gate =
  | { state: 'asking' }
  | { state: 'checking' }
  | { state: 'ok'; store: ServiceStore }
  | { state: 'closed'; store: ServiceStore; message: string }
  | { state: 'out'; message: string };

export default function GroceryPage() {
  const [loc, setLoc] = useState<DdgoLocation | null>(null);
  const [gate, setGate] = useState<Gate>({ state: 'asking' });
  const [cats, setCats] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const check = useCallback(async (l: DdgoLocation) => {
    setGate({ state: 'checking' });
    try {
      const r = await api.get(`/user/serviceability?lat=${l.lat}&lng=${l.lng}`);
      if (r.serviceable && r.store) {
        setGate({ state: 'ok', store: r.store });
      } else if (r.reason === 'closed' && r.store) {
        setGate({ state: 'closed', store: r.store, message: r.message });
      } else {
        setGate({ state: 'out', message: r.message || 'We are not delivering to your area yet.' });
      }
    } catch {
      setGate({ state: 'out', message: 'Could not check your area right now. Please try again.' });
    }
  }, []);

  useEffect(() => {
    const saved = readLocation();
    if (saved) { setLoc(saved); check(saved); }
  }, [check]);

  // The catalogue is fetched only once delivery is possible, and it is fetched
  // WITH the pin so the server can drop anything unreachable rather than
  // showing it and refusing later.
  useEffect(() => {
    if (gate.state !== 'ok' && gate.state !== 'closed') return;
    if (!loc) return;
    setLoadingCatalog(true);
    Promise.all([
      api.get('/categories?platform=ddgo'),
      api.get(`/user/products?platform=ddgo&limit=24&lat=${loc.lat}&lng=${loc.lng}`),
    ])
      .then(([c, p]) => {
        setCats(c.categories || []);
        setProducts(p.products || []);
      })
      .catch(() => {})
      .finally(() => setLoadingCatalog(false));
  }, [gate.state, loc]);

  const useMyLocation = async () => {
    setGate({ state: 'checking' });
    try {
      const { lat, lng } = await requestBrowserLocation();
      saveLocation({ lat, lng, label: 'Current location' });
      const full: DdgoLocation = { lat, lng, label: 'Current location', savedAt: Date.now() };
      setLoc(full);
      check(full);
    } catch (e: any) {
      setGate({ state: 'out', message: e.message });
    }
  };

  const changeLocation = () => {
    clearLocation();
    setLoc(null);
    setProducts([]);
    setCats([]);
    setGate({ state: 'asking' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header gate={gate} loc={loc} onChange={changeLocation} />

      <div className="max-w-[1200px] mx-auto px-4 py-5">
        {gate.state === 'asking' && <LocationGate onUseLocation={useMyLocation} />}
        {gate.state === 'checking' && <Checking />}
        {gate.state === 'out' && <OutOfArea message={gate.message} loc={loc} onRetry={useMyLocation} />}

        {(gate.state === 'ok' || gate.state === 'closed') && (
          <>
            {gate.state === 'closed' && (
              <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-800 flex items-start gap-2">
                <Clock size={16} className="shrink-0 mt-0.5" />
                <span>{gate.message} You can still browse — order when we open.</span>
              </div>
            )}

            {cats.length > 0 && <Categories cats={cats} />}

            {products.length > 0 && (
              <h2 className="text-[17px] font-bold text-gray-900 mt-6 mb-3">Available near you</h2>
            )}

            {loadingCatalog ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-6">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-56 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : products.length ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {products.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>
            ) : (
              <EmptyCatalog />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sticky header: where we are delivering, and how soon ── */
function Header({ gate, loc, onChange }: { gate: Gate; loc: DdgoLocation | null; onChange: () => void }) {
  const store = gate.state === 'ok' || gate.state === 'closed' ? gate.store : null;
  return (
    <div className="sticky top-0 z-30 bg-[#0D7A30] text-white">
      <div className="max-w-[1200px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-extrabold leading-tight">DamnDeal Go</p>
            {store ? (
              <p className="text-[12px] text-white/85 flex items-center gap-1 mt-0.5">
                <Clock size={12} />
                {store.isOpen ? `Delivery in ${store.etaMins} mins` : 'Closed right now'}
                <span className="text-white/50">·</span>
                <span className="truncate">{store.name}</span>
              </p>
            ) : (
              <p className="text-[12px] text-white/85 mt-0.5">Groceries in minutes</p>
            )}
          </div>

          {loc && (
            <button
              onClick={onChange}
              className="shrink-0 flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-full px-3 py-1.5 text-[12px] font-semibold transition"
            >
              <MapPin size={13} /> {loc.label} <ChevronRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LocationGate({ onUseLocation }: { onUseLocation: () => void }) {
  return (
    <div className="max-w-md mx-auto text-center py-16">
      <div className="w-16 h-16 rounded-2xl bg-[#0D7A30]/10 grid place-items-center mx-auto mb-4">
        <MapPin size={30} className="text-[#0D7A30]" />
      </div>
      <h1 className="text-xl font-extrabold text-gray-900">Where should we deliver?</h1>
      <p className="text-[13.5px] text-gray-500 mt-1.5 mb-6">
        We deliver from the store nearest to you, so what is in stock and how fast it arrives both depend on your address.
      </p>
      <button
        onClick={onUseLocation}
        className="w-full py-3.5 rounded-xl bg-[#0D7A30] text-white font-extrabold text-[15px] flex items-center justify-center gap-2 hover:opacity-90 transition"
      >
        <Navigation size={18} /> Use my current location
      </button>
      <p className="text-[11.5px] text-gray-400 mt-3">
        We only read your location when you tap this — never in the background.
      </p>
    </div>
  );
}

function Checking() {
  return (
    <div className="py-24 text-center text-gray-400">
      <LoaderCircle size={28} className="animate-spin mx-auto mb-3 text-[#0D7A30]" />
      <p className="text-[13.5px] font-semibold">Finding your nearest store…</p>
    </div>
  );
}

/* ── Out of area.
   The pin is captured rather than discarded: it is the only real signal we
   have about where the next store should open. ── */
function OutOfArea({ message, loc, onRetry }: { message: string; loc: DdgoLocation | null; onRetry: () => void }) {
  const [phone, setPhone] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  const notify = async () => {
    if (!loc) { onRetry(); return; }
    setBusy(true);
    try {
      const r = await api.post('/user/serviceability/notify', {
        lat: loc.lat, lng: loc.lng, phone: phone.trim(), address: loc.label,
      });
      setDone(r.message || 'Thanks — we will let you know.');
    } catch {
      setDone('Could not save that right now. Please try again later.');
    }
    setBusy(false);
  };

  return (
    <div className="max-w-md mx-auto text-center py-14">
      <div className="w-16 h-16 rounded-2xl bg-amber-50 grid place-items-center mx-auto mb-4">
        <Store size={30} className="text-amber-500" />
      </div>
      <h1 className="text-xl font-extrabold text-gray-900">Not here yet</h1>
      <p className="text-[13.5px] text-gray-500 mt-1.5 mb-6">{message}</p>

      {done ? (
        <p className="text-[13.5px] font-semibold text-[#0D7A30] bg-[#0D7A30]/10 rounded-xl px-4 py-3">{done}</p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, '').slice(0, 15))}
              placeholder="Phone (optional)"
              inputMode="tel"
              className="flex-1 min-w-0 px-3 py-3 rounded-xl border border-gray-200 text-[14px] outline-none focus:border-[#0D7A30]"
            />
            <button
              onClick={notify}
              disabled={busy || !loc}
              className="px-5 rounded-xl bg-[#0D7A30] text-white font-bold text-[14px] flex items-center gap-1.5 disabled:opacity-50"
            >
              <BellRing size={16} /> {busy ? '…' : 'Notify me'}
            </button>
          </div>
          <p className="text-[11.5px] text-gray-400 mt-3">
            We note the areas people ask for, and open there first.
          </p>
        </>
      )}

      <button onClick={onRetry} className="mt-6 text-[13px] font-semibold text-[#0D7A30] hover:underline">
        Try a different location
      </button>
    </div>
  );
}

function Categories({ cats }: { cats: Category[] }) {
  return (
    <>
      <h2 className="text-[17px] font-bold text-gray-900 mb-3">Shop by category</h2>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-3">
        {cats.map((c) => (
          <Link
            key={c._id}
            href={`/categories/${c._id}`}
            className="bg-white rounded-xl border border-gray-100 p-2.5 text-center hover:shadow-md transition"
          >
            <div className="aspect-square rounded-lg overflow-hidden bg-gray-50 mb-1.5 grid place-items-center">
              {(c.icon || c.image) ? (
                <Image src={imgUrl(c.icon || c.image || '')} alt={c.name} width={72} height={72} className="object-contain w-full h-full" />
              ) : <span className="text-2xl">🛒</span>}
            </div>
            <p className="text-[11.5px] font-semibold text-gray-700 leading-tight line-clamp-2">{c.name}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

function EmptyCatalog() {
  return (
    <div className="py-16 text-center text-gray-400">
      <Search size={28} className="mx-auto mb-3" />
      <p className="font-semibold text-gray-600">Nothing on the shelf yet</p>
      <p className="text-[13px] mt-1">
        Your store is set up but has no items stocked. Check back shortly.
      </p>
    </div>
  );
}
