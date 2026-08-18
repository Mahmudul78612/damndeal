'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, CURRENCY_SYMBOL } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  ArrowLeft, Package, Clock, CheckCircle2, XCircle, ChevronRight, LoaderCircle,
} from 'lucide-react';

/**
 * DDGo order history.
 *
 * Kept separate from the marketplace list because the two read differently: a
 * grocery order is measured in minutes and is either on its way or finished,
 * while a shipment lives for days across courier stages.
 */

const LIVE = ['placed', 'confirmed', 'processing', 'ready', 'shipped'];

export default function DdgoOrdersPage() {
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/grocery/orders'); setLoading(false); return; }
    api.get('/user/orders?platform=ddgo&limit=30')
      .then((r) => setOrders(r.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoggedIn, authLoading, openLoginModal]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="max-w-[700px] mx-auto px-4 py-3 flex items-center gap-2">
          <Link href="/grocery" prefetch className="p-1 -ml-1 text-gray-500 hover:text-gray-900">
            <ArrowLeft size={19} />
          </Link>
          <h1 className="text-[16px] font-extrabold text-gray-900">Your DDGo orders</h1>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto px-4 py-4">
        {loading ? (
          <div className="py-24 text-center text-gray-400">
            <LoaderCircle size={24} className="animate-spin mx-auto mb-3 text-[#0D7A30]" />
          </div>
        ) : !isLoggedIn ? (
          <div className="py-24 text-center">
            <p className="text-gray-500 font-semibold">Sign in to see your orders</p>
            <button
              onClick={() => openLoginModal('/grocery/orders')}
              className="mt-4 px-6 py-2.5 bg-[#0D7A30] text-white rounded-xl font-bold text-sm"
            >
              Sign in
            </button>
          </div>
        ) : !orders.length ? (
          <div className="py-24 text-center text-gray-400">
            <Package size={30} className="mx-auto mb-3" />
            <p className="font-bold text-gray-600">No DDGo orders yet</p>
            <Link
              href="/grocery"
              prefetch
              className="inline-block mt-5 px-6 py-2.5 bg-[#0D7A30] text-white rounded-xl font-bold text-sm"
            >
              Browse stores
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => <OrderRow key={o._id} o={o} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function OrderRow({ o }: { o: any }) {
  const live = LIVE.includes(o.status);
  const shop = o.store?.name || o.partner?.name || 'DDGo store';

  return (
    <Link
      href={`/grocery/orders/${o._id}`}
      prefetch
      className="block bg-white rounded-2xl border border-gray-200 p-3.5 hover:border-[#0D7A30]/40 hover:shadow-sm transition"
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${
          live ? 'bg-[#E3F6E9] text-[#0D7A30]'
            : o.status === 'delivered' ? 'bg-emerald-50 text-emerald-600'
            : 'bg-gray-100 text-gray-400'
        }`}>
          {live ? <Clock size={18} /> : o.status === 'delivered' ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-[14px] text-gray-900 truncate">{shop}</p>
            <StatusChip status={o.status} />
          </div>
          <p className="text-[11.5px] text-gray-400 mt-0.5">
            {o.orderNumber} · {new Date(o.createdAt).toLocaleString()}
          </p>
          <p className="text-[12.5px] text-gray-600 mt-1">
            {(o.items || []).length} {(o.items || []).length === 1 ? 'item' : 'items'} ·{' '}
            <b className="text-gray-900">{CURRENCY_SYMBOL}{o.grandTotal}</b>
          </p>
        </div>

        <ChevronRight size={17} className="text-gray-300 shrink-0 mt-1" />
      </div>
    </Link>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { t: string; c: string }> = {
    placed:     { t: 'Placed',     c: 'bg-blue-50 text-blue-700' },
    confirmed:  { t: 'Accepted',   c: 'bg-blue-50 text-blue-700' },
    processing: { t: 'Packing',    c: 'bg-amber-50 text-amber-700' },
    ready:      { t: 'Ready',      c: 'bg-amber-50 text-amber-700' },
    shipped:    { t: 'On the way', c: 'bg-[#E3F6E9] text-[#0D7A30]' },
    delivered:  { t: 'Delivered',  c: 'bg-emerald-50 text-emerald-700' },
    cancelled:  { t: 'Cancelled',  c: 'bg-red-50 text-red-600' },
    returned:   { t: 'Returned',   c: 'bg-gray-100 text-gray-500' },
  };
  const v = map[status] || { t: status, c: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`shrink-0 text-[9.5px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded ${v.c}`}>
      {v.t}
    </span>
  );
}
