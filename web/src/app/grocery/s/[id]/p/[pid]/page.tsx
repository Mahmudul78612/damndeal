'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, imgUrl, CURRENCY_SYMBOL } from '@/lib/api';
import { useDdgoCart } from '@/context/DdgoCartContext';
import { readLocation } from '@/lib/ddgoLocation';
import {
  ArrowLeft, Clock, Store, Plus, Minus, ShoppingBasket, LoaderCircle, ShieldCheck, AlertTriangle,
} from 'lucide-react';

/**
 * Full-page product view for a DDGo item at one store.
 *
 * A page rather than a sheet — the customer can land here from a share or a
 * bookmark, so the pin is re-checked on the server and the store's own price
 * and stock are read fresh. Unorderable or out-of-stock states resolve to a
 * clear message instead of a broken Add button.
 */
export default function DdgoProductPage() {
  const { id, pid } = useParams<{ id: string; pid: string }>();
  const cart = useDdgoCart();

  const [store, setStore] = useState<any>(null);
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const loc = readLocation();
    if (!loc) { setError('Set your delivery location first.'); setLoading(false); return; }
    try {
      const r = await api.get(`/user/ddgo/stores/${id}/product/${pid}?lat=${loc.lat}&lng=${loc.lng}`);
      setStore(r.store); setP(r.product); setError('');
    } catch (e: any) {
      setError(e?.message || 'Product not available.');
    }
    setLoading(false);
  }, [id, pid]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="py-28 text-center text-gray-400">
        <LoaderCircle size={24} className="animate-spin mx-auto mb-3 text-[#0D7A30]" />
      </div>
    );
  }

  if (error || !p || !store) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <AlertTriangle size={28} className="mx-auto mb-3 text-amber-500" />
        <p className="font-bold text-gray-700">{error || 'Product not available'}</p>
        <Link href={`/grocery/s/${id}`} prefetch className="inline-block mt-5 px-6 py-2.5 bg-[#0D7A30] text-white rounded-xl font-bold text-sm">
          Back to store
        </Link>
      </div>
    );
  }

  const qty = cart.getQty(p._id);
  const off = p.mrp > p.sellingPrice ? Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100) : 0;
  const add = () => cart.addItem(
    { productId: p._id, name: p.name, image: (p.images || [])[0] || '', price: p.sellingPrice, mrp: p.mrp, unit: p.unit, quantity: 1, stock: p.stock },
    { id: store.id, name: store.name, type: store.type }
  );

  return (
    <div className="min-h-screen bg-white">
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-[700px] mx-auto px-4 py-3 flex items-center gap-2">
          <Link href={`/grocery/s/${id}`} prefetch className="p-1 -ml-1 text-gray-500 hover:text-gray-900">
            <ArrowLeft size={19} />
          </Link>
          <p className="text-[13px] font-semibold text-gray-500 truncate">{store.name}</p>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto pb-40">
        {/* Image */}
        <div className="relative aspect-square md:aspect-[16/10] bg-gray-50">
          {(p.images || [])[0]
            ? <img src={imgUrl(p.images[0])} alt={p.name} className="w-full h-full object-contain md:object-cover" />
            : <div className="w-full h-full grid place-items-center text-gray-200"><ShoppingBasket size={48} /></div>}
          {off > 0 && (
            <span className="absolute top-3 left-3 bg-[#0D7A30] text-white text-[12px] font-extrabold px-2.5 py-1 rounded-lg">
              {off}% OFF
            </span>
          )}
        </div>

        <div className="px-4 py-4">
          {p.category?.name && (
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-[#0D7A30]">{p.category.name}</p>
          )}
          <h1 className="text-[21px] font-extrabold text-gray-900 leading-snug mt-1">{p.name}</h1>
          {p.unit && <p className="text-[13px] text-gray-400 mt-0.5">{p.unit}</p>}

          <div className="flex items-center gap-2.5 mt-3">
            <span className="text-[24px] font-extrabold text-gray-900">{CURRENCY_SYMBOL}{p.sellingPrice}</span>
            {off > 0 && <span className="text-[15px] text-gray-400 line-through">{CURRENCY_SYMBOL}{p.mrp}</span>}
            {off > 0 && <span className="text-[13px] font-bold text-[#0D7A30]">{off}% off</span>}
          </div>

          {p.stock <= 5 && (
            <p className="text-[12.5px] font-bold text-amber-600 mt-2">Hurry — only {p.stock} left at this store</p>
          )}

          {p.description && (
            <div className="mt-5">
              <h2 className="text-[13.5px] font-bold text-gray-900 mb-1.5">Product details</h2>
              <p className="text-[13.5px] text-gray-600 leading-relaxed whitespace-pre-line">{p.description}</p>
            </div>
          )}

          <Link
            href={`/grocery/s/${store.id}`}
            prefetch
            className="mt-5 flex items-center gap-2.5 bg-gray-50 rounded-xl p-3 border border-gray-100"
          >
            <div className="w-9 h-9 rounded-lg bg-[#E3F6E9] grid place-items-center shrink-0">
              <Store size={16} className="text-[#0D7A30]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-bold text-gray-900 truncate">{store.name}</p>
              <p className="text-[11.5px] text-gray-500 flex items-center gap-1">
                <Clock size={11} className={store.isOpen ? 'text-[#0D7A30]' : 'text-gray-400'} />
                {store.isOpen ? `Delivery in ${store.etaMins} mins` : 'Currently closed'}
              </p>
            </div>
          </Link>

          <p className="mt-4 text-[11.5px] text-gray-400 flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-[#0D7A30]" /> Fresh stock, delivered from a store near you
          </p>
        </div>
      </div>

      {/* Sticky add bar */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 px-4 py-3">
        <div className="max-w-[700px] mx-auto flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[17px] font-extrabold text-gray-900 leading-none">{CURRENCY_SYMBOL}{p.sellingPrice}</p>
            {p.unit && <p className="text-[11px] text-gray-400 mt-1">{p.unit}</p>}
          </div>
          {qty > 0 ? (
            <div className="flex-1 flex items-center justify-between bg-[#0D7A30] text-white rounded-xl px-2 py-1 max-w-[240px] ml-auto">
              <button onClick={() => cart.updateQty(p._id, qty - 1)} className="p-2.5"><Minus size={18} /></button>
              <span className="text-[15px] font-extrabold">{qty} in basket</span>
              <button onClick={() => cart.updateQty(p._id, Math.min(qty + 1, p.stock))} disabled={qty >= p.stock} className="p-2.5 disabled:opacity-40">
                <Plus size={18} />
              </button>
            </div>
          ) : (
            <button onClick={add} className="flex-1 max-w-[240px] ml-auto py-3 rounded-xl bg-[#0D7A30] text-white font-extrabold text-[15px]">
              Add to basket
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
