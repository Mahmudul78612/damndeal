'use client';

/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useDdgoCart } from '@/context/DdgoCartContext';
import { imgUrl, CURRENCY_SYMBOL } from '@/lib/api';
import { readLocation } from '@/lib/ddgoLocation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft, Plus, Minus, Trash2, ShoppingBasket, Store, Clock, ShieldCheck,
} from 'lucide-react';

/**
 * The DDGo basket.
 *
 * Separate from the marketplace cart on purpose — a rider leaving one shop in
 * minutes is a different promise from a courier shipment, and the two baskets
 * used to overwrite each other.
 */
export default function DdgoCartPage() {
  const cart = useDdgoCart();
  const [locLabel, setLocLabel] = useState('');

  useEffect(() => {
    const l = readLocation();
    setLocLabel(l?.label || '');
  }, []);

  if (!cart.itemCount) {
    return (
      <div className="min-h-screen bg-gray-50">
        <TopBar />
        <div className="max-w-[700px] mx-auto px-4 py-24 text-center text-gray-400">
          <ShoppingBasket size={32} className="mx-auto mb-3" />
          <p className="font-bold text-gray-600">Your basket is empty</p>
          <Link
            href="/grocery"
            prefetch
            className="inline-block mt-5 px-6 py-2.5 bg-[#0D7A30] text-white rounded-xl font-bold text-sm"
          >
            Browse stores
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />

      <div className="max-w-[700px] mx-auto px-4 py-4 pb-40">
        {/* Which shop is packing this */}
        <div className="bg-white rounded-2xl border border-gray-200 p-3.5 flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#E3F6E9] grid place-items-center shrink-0">
            <Store size={18} className="text-[#0D7A30]" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[14px] text-gray-900 truncate">{cart.storeName}</p>
            <p className="text-[11.5px] text-gray-500 truncate">
              {locLabel ? `Delivering to ${locLabel}` : 'One store per order'}
            </p>
          </div>
        </div>

        {/* Lines */}
        <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
          {cart.items.map((i) => (
            <div key={i.productId} className="p-3 flex gap-3 items-center">
              <div className="w-14 h-14 rounded-lg bg-gray-50 overflow-hidden shrink-0 grid place-items-center">
                {i.image
                  ? <img src={imgUrl(i.image)} alt={i.name} className="w-full h-full object-cover" />
                  : <ShoppingBasket size={18} className="text-gray-300" />}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-semibold text-gray-900 leading-snug line-clamp-2">{i.name}</p>
                {i.unit && <p className="text-[11px] text-gray-400 mt-0.5">{i.unit}</p>}
                <p className="text-[13px] font-extrabold text-gray-900 mt-1">
                  {CURRENCY_SYMBOL}{i.price * i.quantity}
                  {i.mrp > i.price && (
                    <span className="text-[11px] text-gray-400 line-through font-normal ml-1.5">
                      {CURRENCY_SYMBOL}{i.mrp * i.quantity}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1 bg-[#0D7A30] text-white rounded-lg shrink-0">
                <button onClick={() => cart.updateQty(i.productId, i.quantity - 1)} className="px-2 py-1.5">
                  {i.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                </button>
                <span className="text-[13px] font-bold min-w-[16px] text-center">{i.quantity}</span>
                <button
                  onClick={() => cart.updateQty(i.productId, i.quantity + 1)}
                  disabled={i.quantity >= i.stock}
                  className="px-2 py-1.5 disabled:opacity-40"
                  title={i.quantity >= i.stock ? `Only ${i.stock} in stock at this store` : ''}
                >
                  <Plus size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bill */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-3">
          <p className="font-bold text-[13.5px] text-gray-900 mb-2.5">Bill summary</p>
          <Row label={`Items (${cart.itemCount})`} value={`${CURRENCY_SYMBOL}${cart.subtotal}`} />
          {cart.savings > 0 && (
            <Row label="You save" value={`− ${CURRENCY_SYMBOL}${cart.savings}`} good />
          )}
          <p className="text-[11.5px] text-gray-400 mt-2.5 pt-2.5 border-t border-gray-100">
            Delivery charges and taxes are calculated at checkout, once the address is confirmed.
          </p>
        </div>

        <button
          onClick={cart.clear}
          className="w-full mt-3 py-2.5 text-[12.5px] font-semibold text-gray-400 hover:text-red-500 transition"
        >
          Empty this basket
        </button>
      </div>

      {/* Checkout */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 px-4 py-3">
        <div className="max-w-[700px] mx-auto flex items-center gap-3">
          <div className="min-w-0">
            <p className="text-[16px] font-extrabold text-gray-900 leading-none">
              {CURRENCY_SYMBOL}{cart.subtotal}
            </p>
            <p className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
              <Clock size={11} /> {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
            </p>
          </div>
          <Link
            href="/checkout"
            prefetch
            className="flex-1 py-3 rounded-xl bg-[#0D7A30] text-white font-extrabold text-[15px] text-center"
          >
            Proceed to checkout
          </Link>
        </div>
        <p className="max-w-[700px] mx-auto text-[10.5px] text-gray-400 mt-2 flex items-center gap-1 justify-center">
          <ShieldCheck size={11} className="text-[#0D7A30]" /> One store per order, so it reaches you fast
        </p>
      </div>
    </div>
  );
}

function TopBar() {
  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
      <div className="max-w-[700px] mx-auto px-4 py-3 flex items-center gap-2">
        <Link href="/grocery" prefetch className="p-1 -ml-1 text-gray-500 hover:text-gray-900">
          <ArrowLeft size={19} />
        </Link>
        <h1 className="text-[16px] font-extrabold text-gray-900">Your basket</h1>
      </div>
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13px] text-gray-600">{label}</span>
      <span className={`text-[13px] font-bold ${good ? 'text-[#0D7A30]' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}
