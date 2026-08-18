'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, imgUrl, CURRENCY_SYMBOL } from '@/lib/api';
import {
  ArrowLeft, Store, Phone, MapPin, Bike, CheckCircle2, Clock, XCircle,
  LoaderCircle, RefreshCw, ShoppingBasket, KeyRound,
} from 'lucide-react';

/**
 * Tracking one DDGo order.
 *
 * The stages a grocery order actually passes through are short and physical —
 * the shop accepts it, packs it, hands it to a rider, the rider arrives — so
 * the page is that sequence rather than a courier's status codes. Polling is
 * used instead of a socket: a quick-commerce order is over in minutes, and a
 * refresh every twenty seconds is far cheaper than holding a connection open.
 */

const STAGES = [
  { key: 'placed',     label: 'Order placed',   sub: 'Waiting for the store to accept' },
  { key: 'confirmed',  label: 'Accepted',       sub: 'The store is preparing your order' },
  { key: 'processing', label: 'Being packed',   sub: 'Items are being picked' },
  { key: 'ready',      label: 'Ready',          sub: 'Waiting for a delivery partner' },
  { key: 'shipped',    label: 'On the way',     sub: 'Your order has left the store' },
  { key: 'delivered',  label: 'Delivered',      sub: 'Enjoy!' },
];

export default function DdgoTrackPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/user/orders/${id}`);
      setOrder(r.order);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Could not load this order.');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Stop polling once the order is finished — nothing more will change.
  useEffect(() => {
    if (!order) return;
    if (['delivered', 'cancelled', 'returned'].includes(order.status)) return;
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [order, load]);

  if (loading) {
    return (
      <div className="py-28 text-center text-gray-400">
        <LoaderCircle size={24} className="animate-spin mx-auto mb-3 text-[#0D7A30]" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-md mx-auto text-center py-24 px-4">
        <p className="font-bold text-gray-700">{error || 'Order not found'}</p>
        <Link href="/grocery/orders" prefetch className="inline-block mt-5 px-6 py-2.5 bg-[#0D7A30] text-white rounded-xl font-bold text-sm">
          All orders
        </Link>
      </div>
    );
  }

  const cancelled = order.status === 'cancelled';
  const currentIdx = STAGES.findIndex((s) => s.key === order.status);
  const shop = order.store?.name || order.partner?.name || 'DDGo store';
  const shopPhone = order.store?.contactPhone || order.partner?.phone || '';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="max-w-[700px] mx-auto px-4 py-3 flex items-center gap-2">
          <Link href="/grocery/orders" prefetch className="p-1 -ml-1 text-gray-500 hover:text-gray-900">
            <ArrowLeft size={19} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-extrabold text-gray-900 truncate">{order.orderNumber}</h1>
            <p className="text-[11px] text-gray-400">{new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <button onClick={load} className="p-1.5 text-gray-400 hover:text-[#0D7A30]" title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto px-4 py-4 space-y-3">
        {/* Progress */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          {cancelled ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 grid place-items-center shrink-0">
                <XCircle size={20} className="text-red-500" />
              </div>
              <div>
                <p className="font-extrabold text-[15px] text-gray-900">Order cancelled</p>
                {order.cancelReason && <p className="text-[12.5px] text-gray-500 mt-0.5">{order.cancelReason}</p>}
              </div>
            </div>
          ) : (
            <>
              {order.estimatedDeliveryMinutes > 0 && order.status !== 'delivered' && (
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                  <Clock size={16} className="text-[#0D7A30]" />
                  <p className="text-[14px] font-extrabold text-gray-900">
                    Arriving in about {order.estimatedDeliveryMinutes} minutes
                  </p>
                </div>
              )}
              <div className="space-y-0">
                {STAGES.map((st, i) => {
                  const done = currentIdx >= i;
                  const active = currentIdx === i;
                  return (
                    <div key={st.key} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`w-6 h-6 rounded-full grid place-items-center shrink-0 ${
                          done ? 'bg-[#0D7A30] text-white' : 'bg-gray-100 text-gray-300'
                        }`}>
                          {done ? <CheckCircle2 size={14} /> : <span className="w-1.5 h-1.5 rounded-full bg-current" />}
                        </div>
                        {i < STAGES.length - 1 && (
                          <div className={`w-0.5 flex-1 min-h-[22px] ${currentIdx > i ? 'bg-[#0D7A30]' : 'bg-gray-100'}`} />
                        )}
                      </div>
                      <div className={`pb-4 ${active ? '' : 'opacity-70'}`}>
                        <p className={`text-[13.5px] ${active ? 'font-extrabold text-gray-900' : 'font-semibold text-gray-600'}`}>
                          {st.label}
                        </p>
                        {active && <p className="text-[12px] text-gray-500 mt-0.5">{st.sub}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* The code the rider asks for */}
        {order.deliveryOtp && !['delivered', 'cancelled'].includes(order.status) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 grid place-items-center shrink-0">
              <KeyRound size={18} className="text-amber-600" />
            </div>
            <div>
              <p className="text-[11.5px] text-gray-500">Give this code to the delivery partner</p>
              <p className="text-[20px] font-extrabold tracking-[0.2em] text-gray-900">{order.deliveryOtp}</p>
            </div>
          </div>
        )}

        {/* Rider */}
        {order.deliveryBoy && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E3F6E9] grid place-items-center shrink-0">
              <Bike size={18} className="text-[#0D7A30]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11.5px] text-gray-500">Delivery partner</p>
              <p className="font-bold text-[14px] text-gray-900 truncate">{order.deliveryBoy.name}</p>
            </div>
            {order.deliveryBoy.phone && (
              <a href={`tel:${order.deliveryBoy.phone}`} className="shrink-0 w-9 h-9 rounded-full bg-[#0D7A30] text-white grid place-items-center">
                <Phone size={15} />
              </a>
            )}
          </div>
        )}

        {/* Store */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-50 grid place-items-center shrink-0">
            <Store size={18} className="text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11.5px] text-gray-500">Ordered from</p>
            <p className="font-bold text-[14px] text-gray-900 truncate">{shop}</p>
          </div>
          {shopPhone && (
            <a href={`tel:${shopPhone}`} className="shrink-0 w-9 h-9 rounded-full border border-gray-200 text-gray-500 grid place-items-center">
              <Phone size={15} />
            </a>
          )}
        </div>

        {/* Address */}
        {order.deliveryAddress && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 flex gap-3">
            <MapPin size={17} className="text-gray-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11.5px] text-gray-500">Delivering to</p>
              <p className="text-[13px] text-gray-800 leading-relaxed">
                {[order.deliveryAddress.address, order.deliveryAddress.city, order.deliveryAddress.pincode]
                  .filter(Boolean).join(', ')}
              </p>
            </div>
          </div>
        )}

        {/* Items + bill */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <p className="px-4 pt-4 pb-2 font-bold text-[13.5px] text-gray-900">
            {(order.items || []).length} {(order.items || []).length === 1 ? 'item' : 'items'}
          </p>
          <div className="divide-y divide-gray-100">
            {(order.items || []).map((it: any, i: number) => (
              <div key={i} className="px-4 py-2.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-50 overflow-hidden shrink-0 grid place-items-center">
                  {it.product?.images?.[0]
                    ? <img src={imgUrl(it.product.images[0])} alt={it.name} className="w-full h-full object-cover" />
                    : <ShoppingBasket size={15} className="text-gray-300" />}
                </div>
                <p className="flex-1 min-w-0 text-[13px] text-gray-800 truncate">
                  {it.name} <span className="text-gray-400">× {it.quantity}</span>
                </p>
                <p className="text-[13px] font-bold text-gray-900 shrink-0">
                  {CURRENCY_SYMBOL}{it.total ?? it.price * it.quantity}
                </p>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-1">
            <Bill label="Items" value={order.subtotal} />
            {order.deliveryFee > 0 && <Bill label="Delivery" value={order.deliveryFee} />}
            {order.platformFee > 0 && <Bill label="Platform fee" value={order.platformFee} />}
            {order.codFee > 0 && <Bill label="COD fee" value={order.codFee} />}
            {order.discount > 0 && <Bill label="Discount" value={-order.discount} />}
            <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-gray-200">
              <span className="text-[13.5px] font-extrabold text-gray-900">Total paid</span>
              <span className="text-[15px] font-extrabold text-gray-900">
                {CURRENCY_SYMBOL}{order.grandTotal}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 pt-1">
              {order.paymentMethod === 'cod' ? 'Cash on delivery' : `Paid by ${order.paymentMethod}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Bill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12.5px] text-gray-600">{label}</span>
      <span className="text-[12.5px] font-semibold text-gray-800">
        {value < 0 ? '− ' : ''}{CURRENCY_SYMBOL}{Math.abs(value)}
      </span>
    </div>
  );
}
