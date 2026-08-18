'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api, imgUrl, CURRENCY_SYMBOL } from '@/lib/api';
import {
  MapPin, Navigation, Clock, ChevronRight, Store, LoaderCircle, BellRing, Bike, ShoppingBasket, Package, Zap, Search,
} from 'lucide-react';
import {
  readLocation, saveLocation, clearLocation, requestBrowserLocation, DdgoLocation,
  readServingStore, saveServingStore, clearServingStore,
} from '@/lib/ddgoLocation';
import LocationPicker from '@/components/ddgo/LocationPicker';
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
  coverImage?: string;
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
  const [banners, setBanners] = useState<DdgoBanner[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  // Set when the pin moved to a different store while a cart was still open.
  const [staleCart, setStaleCart] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
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
    api.get('/user/ddgo/banners').then((r) => setBanners(r.banners || [])).catch(() => {});
    api.get(`/user/ddgo/stores?lat=${loc.lat}&lng=${loc.lng}`)
      .then((r) => setStores(r.stores || []))
      .catch(() => setStores([]))
      .finally(() => setLoadingCatalog(false));
  }, [gate.state, loc]);

  const applyLocation = (l: { lat: number; lng: number; label: string }) => {
    saveLocation(l);
    const full: DdgoLocation = { ...l, savedAt: Date.now() };
    setLoc(full);
    setPickerOpen(false);
    check(full);
  };

  // GPS may be blocked (notably inside the app's WebView), so failure opens
  // the picker to search by name rather than dead-ending.
  const useMyLocation = async () => {
    try {
      const { lat, lng } = await requestBrowserLocation();
      applyLocation({ lat, lng, label: 'Current location' });
    } catch {
      setPickerOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header gate={gate} loc={loc} onChange={() => setPickerOpen(true)} />

      <div className="max-w-[1200px] mx-auto px-4 py-5">
        {gate.state === 'asking' && <LocationGate onUseLocation={useMyLocation} onSearch={() => setPickerOpen(true)} />}
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
                {banners.length > 0 && <BannerCarousel banners={banners} />}
                <div className="flex items-baseline justify-between gap-3 mb-3 mt-1">
                  <h2 className="text-[16px] font-extrabold text-gray-900">
                    {stores.length} {stores.length === 1 ? 'store' : 'stores'} near you
                  </h2>
                  <span className="text-[11.5px] text-gray-400">Nearest first</span>
                </div>
                <div className="grid gap-3.5 sm:grid-cols-2">
                  {stores.map((st) => <StoreCard key={st.id} s={st} />)}
                </div>
              </>
            ) : (
              <EmptyCatalog />
            )}
          </>
        )}
      </div>

      {pickerOpen && (
        <LocationPicker onPick={applyLocation} onClose={() => setPickerOpen(false)} />
      )}
    </div>
  );
}

/* ── Sticky header ──
   Zomato-style: the delivery address is the headline and the whole bar taps
   through to the location picker; the ETA rides as a small line beneath it. */
function Header({ gate, loc, onChange }: { gate: Gate; loc: DdgoLocation | null; onChange: () => void }) {
  const store = gate.state === 'ok' || gate.state === 'closed' ? gate.store : null;
  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,.04)]">
      <div className="max-w-[1200px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        <button onClick={onChange} className="min-w-0 flex items-start gap-1.5 text-left">
          <MapPin size={18} className="text-[#0D7A30] shrink-0 mt-0.5" />
          <span className="min-w-0">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              Deliver to <ChevronRight size={11} className="rotate-90" />
            </span>
            <span className="block text-[14.5px] font-extrabold text-gray-900 truncate max-w-[200px] sm:max-w-[360px] leading-tight">
              {loc ? loc.label : 'Select location'}
            </span>
            {store && (
              <span className="block text-[11.5px] text-gray-500 mt-0.5">
                {store.isOpen ? `Delivery in ${store.etaMins} mins · ${store.name}` : `Closed · ${store.name}`}
              </span>
            )}
          </span>
        </button>

        <span className="shrink-0 w-9 h-9 rounded-full bg-[#0D7A30]/10 grid place-items-center">
          <Zap size={17} className="text-[#0D7A30]" fill="#0D7A30" />
        </span>
      </div>
    </div>
  );
}

function LocationGate({ onUseLocation, onSearch }: { onUseLocation: () => void; onSearch: () => void }) {
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
      <button
        onClick={onSearch}
        className="w-full py-3 mt-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-[14px] flex items-center justify-center gap-2 hover:border-[#0D7A30] transition"
      >
        <Search size={16} /> Search for your area
      </button>
      <p className="text-[11.5px] text-gray-400 mt-3">
        Location is only read when you tap — never in the background.
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

interface DdgoBanner {
  _id: string;
  title?: string;
  subtitle?: string;
  image: string;
  linkType?: string;
  linkValue?: string;
}

/* Promotional banners for the DDGo home — a swipeable rail with dots, the way
   the marketplace carousel works. The link is admin-set; an internal path
   routes client-side, an external URL opens as-is. */
function BannerCarousel({ banners }: { banners: DdgoBanner[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % banners.length), 4000);
    return () => clearInterval(t);
  }, [banners.length]);

  const href = (b: DdgoBanner) => {
    const v = (b.linkValue || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v) || v.startsWith('/')) return v;
    if (b.linkType === 'category') return `/categories/${v}`;
    if (b.linkType === 'product') return `/product/${v}`;
    return '';
  };

  const b = banners[i];
  const to = href(b);
  const Img = (
    <div className="relative w-full aspect-[2.6/1] rounded-2xl overflow-hidden bg-gray-100">
      <img src={imgUrl(b.image)} alt={b.title || 'Offer'} className="w-full h-full object-cover" />
    </div>
  );

  return (
    <div className="mb-4">
      {to ? <a href={to}>{Img}</a> : Img}
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2">
          {banners.map((_, n) => (
            <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-5 bg-[#0D7A30]' : 'w-1.5 bg-gray-300'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function StoreCard({ s }: { s: NearbyStore }) {
  const cover = s.coverImage || '';
  return (
    <Link
      href={`/grocery/s/${s.id}`}
      prefetch
      className={`group block bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all hover:shadow-[0_6px_20px_rgba(16,24,40,.10)] ${
        s.isOpen ? '' : 'opacity-70'
      }`}
    >
      {/* Cover */}
      <div className="relative aspect-[2.4/1] bg-gray-100">
        {cover ? (
          <img src={imgUrl(cover)} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#0D7A30]/15 to-[#0D7A30]/5 grid place-items-center">
            <Store size={26} className="text-[#0D7A30]/40" />
          </div>
        )}
        {/* ETA chip */}
        <span className={`absolute bottom-2 left-2 inline-flex items-center gap-1 text-[11.5px] font-extrabold px-2 py-1 rounded-lg shadow ${
          s.isOpen ? 'bg-white text-[#0D7A30]' : 'bg-white text-gray-500'
        }`}>
          <Clock size={11} /> {s.isOpen ? `${s.etaMins} min` : 'Closed'}
        </span>
        {!s.isOpen && (
          <span className="absolute inset-0 bg-black/35 grid place-items-center">
            <span className="text-white text-[12px] font-extrabold uppercase tracking-wide">Opens at 7 AM</span>
          </span>
        )}
      </div>

      {/* Row: logo + details */}
      <div className="flex gap-3 items-center p-3">
        <div className="w-11 h-11 rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden shrink-0 grid place-items-center -mt-7 relative z-10">
          {s.logo ? (
            <Image src={imgUrl(s.logo)} alt={s.name} width={44} height={44} className="object-cover w-full h-full" />
          ) : (
            <Store size={18} className="text-gray-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[15px] text-gray-900 truncate group-hover:text-[#0D7A30] transition">{s.name}</p>
          <p className="text-[11.5px] text-gray-500 truncate mt-0.5 flex items-center gap-1.5">
            <span className="flex items-center gap-1"><Bike size={11} className="text-gray-400" /> {s.distanceKm} km</span>
            <span className="text-gray-300">·</span>
            <span>{s.itemCount} items</span>
            {s.minOrderAmount > 0 && <><span className="text-gray-300">·</span><span>Min {CURRENCY_SYMBOL}{s.minOrderAmount}</span></>}
          </p>
        </div>
        <ChevronRight size={18} className="text-gray-300 group-hover:text-[#0D7A30] transition shrink-0" />
      </div>
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
