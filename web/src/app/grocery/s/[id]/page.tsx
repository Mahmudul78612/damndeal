'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, imgUrl, CURRENCY_SYMBOL } from '@/lib/api';
import { useDdgoCart } from '@/context/DdgoCartContext';
import {
  ArrowLeft, Clock, Bike, Store, LoaderCircle, Plus, Minus, ShoppingBasket, MapPin,
  AlertTriangle,
} from 'lucide-react';
import { readLocation } from '@/lib/ddgoLocation';

/**
 * One DDGo store and what it is selling right now.
 *
 * The pin is sent with every request and the server re-checks it, so arriving
 * here from a bookmark or a stale tab cannot show an orderable shop that
 * nobody can deliver from.
 */

interface StoreInfo {
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

interface Item {
  _id: string;
  name: string;
  images?: string[];
  unit?: string;
  description?: string;
  sellingPrice: number;
  mrp: number;
  stock: number;
  category?: { _id?: string; name?: string };
}

export default function StorePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const cart = useDdgoCart();

  const [store, setStore] = useState<StoreInfo | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<{ _id: string; name: string }[]>([]);
  const [activeCat, setActiveCat] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const loc = readLocation();
    if (!loc) {
      // No pin, no honest answer — send them back to set one.
      router.replace('/grocery');
      return;
    }
    setLoading(true);
    try {
      const r = await api.get(`/user/ddgo/stores/${id}?lat=${loc.lat}&lng=${loc.lng}&limit=50`);
      setStore(r.store);
      setItems(r.products || []);
      setCats(r.categories || []);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not open this store.');
    }
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="py-28 text-center text-gray-400">
        <LoaderCircle size={26} className="animate-spin mx-auto mb-3 text-[#0D7A30]" />
        <p className="text-[13.5px] font-semibold">Opening the store…</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="max-w-md mx-auto text-center py-20 px-4">
        <Store size={30} className="mx-auto mb-3 text-amber-500" />
        <p className="font-bold text-gray-700">{error || 'Store not found'}</p>
        <Link href="/grocery" className="inline-block mt-5 px-6 py-2.5 bg-[#0D7A30] text-white rounded-xl font-bold text-sm">
          Back to stores
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Store header */}
      <div className="bg-[#0D7A30] text-white">
        <div className="max-w-[1200px] mx-auto px-4 py-3">
          <Link href="/grocery" className="inline-flex items-center gap-1.5 text-[13px] font-semibold opacity-90 hover:opacity-100">
            <ArrowLeft size={16} /> All stores
          </Link>
        </div>
      </div>

      <div className="bg-white border-b border-gray-100">
        <div className="max-w-[1200px] mx-auto px-4 py-4 flex gap-3 items-center">
          <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 grid place-items-center">
            {store.logo
              ? <img src={imgUrl(store.logo)} alt={store.name} className="object-cover w-full h-full" />
              : <Store size={24} className="text-gray-300" />}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-extrabold text-gray-900 truncate">{store.name}</h1>
            {store.address && (
              <p className="text-[12px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
                <MapPin size={11} /> {store.address}
              </p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-[12.5px] text-gray-600">
              <span className="flex items-center gap-1">
                <Clock size={12} className={store.isOpen ? 'text-[#0D7A30]' : 'text-gray-400'} />
                {store.isOpen ? `${store.etaMins} mins` : 'Closed right now'}
              </span>
              <span className="flex items-center gap-1"><Bike size={12} className="text-gray-400" /> {store.distanceKm} km</span>
              {store.minOrderAmount > 0 && (
                <span className="text-gray-500">Min {CURRENCY_SYMBOL}{store.minOrderAmount}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 py-5">
        {!store.isOpen && (
          <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-800">
            This store is closed right now. You can look through the shelf and order when it opens.
          </div>
        )}

        {cats.length > 1 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 -mx-4 px-4">
            <Chip label="All" active={!activeCat} onClick={() => setActiveCat('')} />
            {cats.map((c) => (
              <Chip key={c._id} label={c.name} active={activeCat === String(c._id)}
                onClick={() => setActiveCat(activeCat === String(c._id) ? '' : String(c._id))} />
            ))}
          </div>
        )}

        {items.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <ShoppingBasket size={28} className="mx-auto mb-3" />
            <p className="font-semibold text-gray-600">Nothing on the shelf right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pb-24">
            {items
              .filter((it) => !activeCat || String(it.category?._id) === activeCat)
              .map((it) => (
                <ItemCard key={it._id} it={it} store={store} cart={cart} />
              ))}
          </div>
        )}
      </div>

      <SwitchStoreDialog cart={cart} />
    </div>
  );
}

/* A rider collects from one shop, so a basket belongs to one shop. Switching
   is offered as a decision rather than done silently. */
function SwitchStoreDialog({ cart }: { cart: any }) {
  if (!cart.pending) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4 bg-black/45" onClick={cart.cancelSwitch}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-12 rounded-full bg-amber-50 grid place-items-center mx-auto mb-3">
          <AlertTriangle size={22} className="text-amber-500" />
        </div>
        <h3 className="font-extrabold text-[16px] text-gray-900">Start a new basket?</h3>
        <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">
          Your basket has items from <b className="text-gray-700">{cart.storeName}</b>. One rider
          collects from one store, so adding from <b className="text-gray-700">{cart.pending.storeName}</b> will
          empty it.
        </p>
        <div className="flex gap-2 mt-5">
          <button
            onClick={cart.cancelSwitch}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-[13.5px] text-gray-600"
          >
            Keep it
          </button>
          <button
            onClick={cart.confirmSwitch}
            className="flex-1 py-2.5 rounded-xl bg-[#0D7A30] text-white font-extrabold text-[13.5px]"
          >
            Start new
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12.5px] font-bold transition border ${
        active
          ? 'bg-[#0D7A30] text-white border-[#0D7A30]'
          : 'bg-white text-gray-600 border-gray-200 hover:border-[#0D7A30]/50'
      }`}
    >
      {label}
    </button>
  );
}

function ItemCard({ it, store, cart }: { it: Item; store: StoreInfo; cart: any }) {
  const href = `/grocery/s/${store.id}/p/${it._id}`;
  const qty = cart.getQty ? cart.getQty(it._id) : 0;
  const off = it.mrp > it.sellingPrice ? Math.round(((it.mrp - it.sellingPrice) / it.mrp) * 100) : 0;

  const add = () => {
    // Returns false when the basket belongs to another shop; the provider
    // raises the switch dialog and nothing is lost in the meantime.
    cart.addItem(
      {
        productId: it._id,
        name: it.name,
        image: (it.images || [])[0] || '',
        price: it.sellingPrice,
        mrp: it.mrp,
        unit: it.unit,
        quantity: 1,
        stock: it.stock,
      },
      { id: store.id, name: store.name, type: store.type }
    );
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
      <Link href={href} prefetch className="relative aspect-square bg-gray-50 block w-full">
        {(it.images || [])[0]
          ? <img src={imgUrl(it.images![0])} alt={it.name} className="w-full h-full object-cover" loading="lazy" />
          : <div className="w-full h-full grid place-items-center text-gray-200"><ShoppingBasket size={26} /></div>}
        {off > 0 && (
          <span className="absolute top-1.5 left-1.5 bg-[#0D7A30] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded">
            {off}% OFF
          </span>
        )}
        {it.stock <= 5 && (
          <span className="absolute bottom-1.5 left-1.5 bg-amber-500 text-white text-[9.5px] font-bold px-1.5 py-0.5 rounded">
            Only {it.stock} left
          </span>
        )}
      </Link>

      <div className="p-2 flex-1 flex flex-col">
        <Link href={href} prefetch className="text-left">
          <p className="text-[12.5px] font-semibold text-gray-800 leading-snug line-clamp-2">{it.name}</p>
        </Link>
        {it.unit && <p className="text-[11px] text-gray-400 mt-0.5">{it.unit}</p>}

        <div className="mt-auto pt-2 flex items-end justify-between gap-1">
          <div className="min-w-0">
            <p className="text-[14px] font-extrabold text-gray-900">{CURRENCY_SYMBOL}{it.sellingPrice}</p>
            {off > 0 && <p className="text-[11px] text-gray-400 line-through">{CURRENCY_SYMBOL}{it.mrp}</p>}
          </div>

          {qty > 0 ? (
            <div className="flex items-center gap-1 bg-[#0D7A30] text-white rounded-lg shrink-0">
              <button onClick={() => cart.updateQty(it._id, qty - 1)} className="px-1.5 py-1"><Minus size={13} /></button>
              <span className="text-[12.5px] font-bold min-w-[14px] text-center">{qty}</span>
              <button
                onClick={() => cart.updateQty(it._id, Math.min(qty + 1, it.stock))}
                disabled={qty >= it.stock}
                className="px-1.5 py-1 disabled:opacity-40"
              >
                <Plus size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={add}
              className="shrink-0 border border-[#0D7A30] text-[#0D7A30] font-extrabold text-[12px] px-3 py-1.5 rounded-lg hover:bg-[#0D7A30] hover:text-white transition"
            >
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
