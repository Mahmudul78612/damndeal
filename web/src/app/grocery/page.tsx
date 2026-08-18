'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api, imgUrl, CURRENCY_SYMBOL } from '@/lib/api';
import {
  MapPin, Navigation, Clock, ChevronRight, Store, LoaderCircle, BellRing, Bike, ShoppingBasket, Package,
} from 'lucide-react';
import {
  readLocation, saveLocation, clearLocation, requestBrowserLocation, DdgoLocation,
  readServingStore, saveServingStore, clearServingStore,
} from '@/lib/ddgoLocation';
import { useCart } from '@/context/CartContext';

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

interface NearbyStore {
  id: string;
  type: 'darkstore' | 'partner';
  name: string;
  logo?: string;
  city?: string;
  address?: string;
  distanceKm: number;
  etaMins: number;
  isOpen: boolean;
  itemCount: number;
  minOrderAmount: number;
  deliveryFee: number;
  freeDeliveryAbove: number;
}

/** How many lines are in the saved cart, without waiting for the context. */
function storedCartCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = JSON.parse(localStorage.getItem('dd_cart') || '[]');
    return Array.isArray(raw) ? raw.length : 0;
  } catch {
    return 0;
  }
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
  const [stores, setStores] = useState<NearbyStore[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  // Set when the pin moved to a different store while a cart was still open.
  const [staleCart, setStaleCart] = useState(false);
  const cart = useCart();

  const check = useCallback(async (l: DdgoLocation) => {
    setGate({ state: 'checking' });
    try {
      const r = await api.get(`/user/serviceability?lat=${l.lat}&lng=${l.lng}`);
      if (r.serviceable && r.store) {
        // A cart built at another store cannot be packed here.
        // The count is read from storage rather than the cart context: this
        // runs on mount, before the context has hydrated, so the context would
        // still report an empty cart and the warning would never appear.
        const previous = readServingStore();
        setStaleCart(!!previous && previous !== r.store.id && storedCartCount() > 0);
        saveServingStore(r.store.id);
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

  // Shops, not products. Quick commerce is browsed shop-first: you pick who is
  // delivering before you pick what, because the price and the wait both belong
  // to whichever shop is packing it.
  useEffect(() => {
    if (gate.state !== 'ok' && gate.state !== 'closed') return;
    if (!loc) return;
    setLoadingCatalog(true);
    api.get(`/user/ddgo/stores?lat=${loc.lat}&lng=${loc.lng}`)
      .then((r) => setStores(r.stores || []))
      .catch(() => setStores([]))
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
    clearServingStore();
    setLoc(null);
    setStores([]);
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
            {staleCart && (
              <div className="mb-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-[13px] text-blue-900 flex items-start justify-between gap-3">
                <span>
                  Your cart was filled at a different store, which cannot deliver here.
                  Start it again for this address.
                </span>
                <button
                  onClick={() => { cart.clear(); setStaleCart(false); }}
                  className="shrink-0 font-bold underline hover:no-underline"
                >
                  Clear cart
                </button>
              </div>
            )}

            {gate.state === 'closed' && (
              <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-800 flex items-start gap-2">
                <Clock size={16} className="shrink-0 mt-0.5" />
                <span>{gate.message} You can still browse — order when we open.</span>
              </div>
            )}

            {loadingCatalog ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : stores.length ? (
              <>
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h2 className="text-[15px] font-extrabold text-gray-900">
                    {stores.length} {stores.length === 1 ? 'store' : 'stores'} near you
                  </h2>
                  <span className="text-[11.5px] text-gray-400">Nearest first</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {stores.map((st) => <StoreCard key={st.id} s={st} />)}
                </div>
              </>
            ) : (
              <EmptyCatalog />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Sticky header ──
   The two things a customer checks constantly are how long it will take and
   which address it is coming to, so those are the header rather than a logo. */
function Header({ gate, loc, onChange }: { gate: Gate; loc: DdgoLocation | null; onChange: () => void }) {
  const store = gate.state === 'ok' || gate.state === 'closed' ? gate.store : null;
  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
      <div className="max-w-[1200px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {store && store.isOpen ? (
            <>
              <p className="text-[17px] font-extrabold text-gray-900 leading-tight">
                Delivery in {store.etaMins} minutes
              </p>
              <p className="text-[12px] text-gray-500 truncate mt-0.5">
                From {store.name}
              </p>
            </>
          ) : store ? (
            <>
              <p className="text-[17px] font-extrabold text-gray-900 leading-tight">Currently closed</p>
              <p className="text-[12px] text-gray-500 truncate mt-0.5">{store.name}</p>
            </>
          ) : (
            <>
              <p className="text-[17px] font-extrabold text-gray-900 leading-tight">DamnDeal Go</p>
              <p className="text-[12px] text-gray-500 mt-0.5">Groceries in minutes</p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
        <Link
          href="/grocery/orders"
          prefetch
          className="w-9 h-9 rounded-xl border border-gray-200 grid place-items-center text-gray-500 hover:border-[#0D7A30] hover:text-[#0D7A30] transition"
          title="Your orders"
        >
          <Package size={16} />
        </Link>
        {loc && (
          <button
            onClick={onChange}
            className="shrink-0 flex items-center gap-1.5 border border-gray-200 hover:border-[#0D7A30] rounded-xl px-3 py-2 transition text-left"
          >
            <MapPin size={15} className="text-[#0D7A30] shrink-0" />
            <span className="min-w-0">
              <span className="block text-[9.5px] font-bold uppercase tracking-wide text-gray-400 leading-none">
                Deliver to
              </span>
              <span className="block text-[12.5px] font-semibold text-gray-800 truncate max-w-[120px] leading-tight mt-0.5">
                {loc.label}
              </span>
            </span>
            <ChevronRight size={14} className="text-gray-300 shrink-0" />
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

function StoreCard({ s }: { s: NearbyStore }) {
  return (
    <Link
      href={`/grocery/s/${s.id}`}
      prefetch
      className={`group flex gap-3.5 items-center bg-white border border-gray-200 rounded-2xl p-3.5 transition-all hover:border-[#0D7A30]/40 hover:shadow-[0_4px_14px_rgba(16,24,40,.07)] ${
        s.isOpen ? '' : 'opacity-65'
      }`}
    >
      <div className="w-[60px] h-[60px] rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0 grid place-items-center">
        {s.logo ? (
          <Image src={imgUrl(s.logo)} alt={s.name} width={60} height={60} className="object-cover w-full h-full" />
        ) : (
          <Store size={22} className="text-gray-300" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-bold text-[15px] text-gray-900 truncate group-hover:text-[#0D7A30] transition">
            {s.name}
          </p>
          {!s.isOpen && (
            <span className="shrink-0 text-[9.5px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              Closed
            </span>
          )}
        </div>

        {/* ETA is the number people actually compare shops on, so it leads. */}
        <div className="flex items-center gap-2 mt-1.5">
          {s.isOpen ? (
            <span className="inline-flex items-center gap-1 bg-[#E3F6E9] text-[#0D7A30] text-[11.5px] font-extrabold px-2 py-0.5 rounded-md">
              <Clock size={11} /> {s.etaMins} min
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-500 text-[11.5px] font-bold px-2 py-0.5 rounded-md">
              <Clock size={11} /> Opens later
            </span>
          )}
          <span className="text-[11.5px] text-gray-500 flex items-center gap-1">
            <Bike size={11} className="text-gray-400" /> {s.distanceKm} km
          </span>
        </div>

        <p className="text-[11.5px] text-gray-400 truncate mt-1">
          {s.itemCount} {s.itemCount === 1 ? 'item' : 'items'}
          {s.city ? ` · ${s.city}` : ''}
          {s.minOrderAmount > 0 ? ` · Min ${CURRENCY_SYMBOL}${s.minOrderAmount}` : ''}
        </p>
      </div>

      <ChevronRight size={18} className="text-gray-300 group-hover:text-[#0D7A30] transition shrink-0" />
    </Link>
  );
}

function EmptyCatalog() {
  return (
    <div className="py-16 text-center text-gray-400">
      <ShoppingBasket size={28} className="mx-auto mb-3" />
      <p className="font-semibold text-gray-600">No store is stocked here yet</p>
      <p className="text-[13px] mt-1">
        We reach your address, but nobody nearby has put anything on the shelf.
        Check back shortly.
      </p>
    </div>
  );
}
