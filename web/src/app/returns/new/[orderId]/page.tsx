'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, Package, Wallet, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, imgUrl } from '@/lib/api';
import { Order } from '@/lib/types';

const REASONS: { value: string; label: string }[] = [
  { value: 'defective', label: 'Item arrived defective / damaged' },
  { value: 'wrong_item', label: 'Wrong item delivered' },
  { value: 'not_as_described', label: 'Item not as described' },
  { value: 'size_issue', label: 'Size / fit issue' },
  { value: 'quality_issue', label: 'Quality not as expected' },
  { value: 'changed_mind', label: 'Changed my mind' },
  { value: 'other', label: 'Other' },
];

const RETURN_WINDOW_DAYS = 7;

export default function NewReturnPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingReturn, setExistingReturn] = useState<any>(null);
  const [reason, setReason] = useState('defective');
  const [note, setNote] = useState('');
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api.get(`/user/orders/${orderId}`).catch(() => null),
      api.get(`/user/returns/order/${orderId}`).catch(() => null),
    ]).then(([orderRes, retRes]) => {
      if (!mounted) return;
      if (orderRes?.order) {
        setOrder(orderRes.order);
        const init: Record<string, number> = {};
        orderRes.order.items.forEach((it: any) => {
          init[it.product?._id || it.product] = it.quantity;
        });
        setSelected(init);
      }
      if (retRes?.returnRequest) setExistingReturn(retRes.returnRequest);
      setLoading(false);
    });
    return () => { mounted = false; };
  }, [orderId]);

  const deliveredAt = order?.deliveredAt || (order as any)?.updatedAt;
  const daysSinceDelivery = useMemo(() => {
    if (!deliveredAt) return null;
    return (Date.now() - new Date(deliveredAt).getTime()) / 86400000;
  }, [deliveredAt]);
  const windowExpired = daysSinceDelivery !== null && daysSinceDelivery > RETURN_WINDOW_DAYS;
  const daysLeft = daysSinceDelivery !== null ? Math.max(0, Math.ceil(RETURN_WINDOW_DAYS - daysSinceDelivery)) : null;

  const totalRefund = useMemo(() => {
    if (!order) return 0;
    return order.items.reduce((sum, it: any) => {
      const pid = it.product?._id || it.product;
      const qty = selected[pid] || 0;
      return sum + (it.price || 0) * qty;
    }, 0);
  }, [order, selected]);

  const hasSelection = Object.values(selected).some((q) => q > 0);

  const toggleItem = (pid: string, max: number) => {
    setSelected((s) => ({ ...s, [pid]: s[pid] > 0 ? 0 : max }));
  };

  const setQty = (pid: string, qty: number, max: number) => {
    const v = Math.min(Math.max(qty, 0), max);
    setSelected((s) => ({ ...s, [pid]: v }));
  };

  const handleSubmit = async () => {
    if (!order || submitting) return;
    setError('');
    if (!hasSelection) { setError('Select at least one item to return'); return; }

    const items = order.items
      .map((it: any) => {
        const pid = it.product?._id || it.product;
        return { product: pid, quantity: selected[pid] || 0 };
      })
      .filter((x) => x.quantity > 0);

    setSubmitting(true);
    try {
      await api.post('/user/returns', { orderId, reason, note, items });
      router.replace('/returns?created=1');
    } catch (e: any) {
      setError(e?.message || 'Failed to submit return request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-4 max-w-3xl mx-auto space-y-3 animate-pulse">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-40 rounded-md" />
        <div className="skeleton h-60 rounded-md" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">Order not found</p>
        <Link href="/orders" className="text-primary font-semibold mt-2 inline-block">Back to orders</Link>
      </div>
    );
  }

  if (existingReturn) {
    return (
      <div className="px-4 py-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-1.5 -ml-1 rounded hover:bg-gray-100"><ChevronLeft size={22} /></button>
          <h1 className="text-lg font-bold text-gray-900">Return Request</h1>
        </div>
        <div className="border border-gray-200 rounded-md bg-white p-4">
          <div className="flex items-center gap-2 text-amber-700 mb-2">
            <AlertCircle size={18} />
            <span className="text-sm font-bold">A return is already in progress for this order</span>
          </div>
          <p className="text-xs text-gray-600 mb-3">Status: <span className="font-semibold uppercase">{existingReturn.status}</span></p>
          <Link href="/returns" className="inline-block px-4 py-2 rounded-md bg-primary text-white text-xs font-bold">View My Returns</Link>
        </div>
      </div>
    );
  }

  if (order.status !== 'delivered') {
    return (
      <div className="px-4 py-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-1.5 -ml-1 rounded hover:bg-gray-100"><ChevronLeft size={22} /></button>
          <h1 className="text-lg font-bold text-gray-900">Return Request</h1>
        </div>
        <div className="border border-gray-200 rounded-md bg-white p-4">
          <p className="text-sm text-gray-700">Only delivered orders can be returned.</p>
          <Link href={`/orders/${order._id}`} className="text-primary font-semibold text-sm mt-2 inline-block">Back to order</Link>
        </div>
      </div>
    );
  }

  if (windowExpired) {
    return (
      <div className="px-4 py-4 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-1.5 -ml-1 rounded hover:bg-gray-100"><ChevronLeft size={22} /></button>
          <h1 className="text-lg font-bold text-gray-900">Return Request</h1>
        </div>
        <div className="border border-gray-200 rounded-md bg-white p-4">
          <div className="flex items-center gap-2 text-red-700 mb-2">
            <AlertCircle size={18} />
            <span className="text-sm font-bold">Return window expired</span>
          </div>
          <p className="text-xs text-gray-600">The {RETURN_WINDOW_DAYS}-day return window for this order has ended.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 -ml-1 rounded hover:bg-gray-100"><ChevronLeft size={22} /></button>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Return Items</h1>
          <p className="text-[11px] text-gray-500">Order #{order.orderNumber}</p>
        </div>
      </div>

      {/* Window notice */}
      {daysLeft !== null && (
        <div className="border border-amber-200 bg-amber-50 rounded-md px-3 py-2 mb-4 flex items-center gap-2">
          <AlertCircle size={14} className="text-amber-700 shrink-0" />
          <p className="text-[12px] text-amber-800">
            {daysLeft > 0
              ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your return window`
              : 'Last day to request return'}
          </p>
        </div>
      )}

      {/* Items */}
      <div className="border border-gray-200 rounded-md bg-white overflow-hidden mb-4">
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
          <h2 className="text-[12px] font-bold tracking-wide text-gray-700 uppercase">1 Select items to return</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {order.items.map((it: any) => {
            const pid = it.product?._id || it.product;
            const qty = selected[pid] || 0;
            const checked = qty > 0;
            const img = it.product?.images?.[0] || it.image;
            return (
              <div key={pid} className="p-3 flex gap-3 items-center">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleItem(pid, it.quantity)}
                  className="w-4 h-4 accent-primary shrink-0"
                />
                <div className="w-12 h-12 rounded bg-gray-50 overflow-hidden relative shrink-0">
                  {img ? (
                    <Image src={imgUrl(img)} alt={it.name} fill className="object-cover" sizes="48px" />
                  ) : <div className="w-full h-full flex items-center justify-center"><Package size={14} className="text-gray-300" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-gray-800 truncate">{it.name}</p>
                  <p className="text-[11px] text-gray-500">₹{it.price?.toFixed(0)} each • Ordered {it.quantity}</p>
                </div>
                {checked && (
                  <div className="flex items-center gap-1 border border-gray-200 rounded">
                    <button onClick={() => setQty(pid, qty - 1, it.quantity)} className="px-2 py-1 text-sm">−</button>
                    <span className="text-[12px] font-semibold w-6 text-center">{qty}</span>
                    <button onClick={() => setQty(pid, qty + 1, it.quantity)} className="px-2 py-1 text-sm">+</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Reason */}
      <div className="border border-gray-200 rounded-md bg-white overflow-hidden mb-4">
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
          <h2 className="text-[12px] font-bold tracking-wide text-gray-700 uppercase">2 Reason for return</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {REASONS.map((r) => (
            <label key={r.value} className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="accent-primary"
              />
              <span className="text-[13px] text-gray-800">{r.label}</span>
            </label>
          ))}
        </div>
        <div className="px-3 pb-3 pt-2 border-t border-gray-100">
          <label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Comments (optional)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="Add details to help us process faster"
            className="w-full mt-1 border border-gray-200 rounded px-2.5 py-2 text-[13px] outline-none focus:border-primary resize-none"
          />
          <p className="text-[10px] text-gray-400 mt-1 text-right">{note.length}/300</p>
        </div>
      </div>

      {/* Refund mode */}
      <div className="border border-gray-200 rounded-md bg-white overflow-hidden mb-4">
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
          <h2 className="text-[12px] font-bold tracking-wide text-gray-700 uppercase">3 Refund</h2>
        </div>
        <div className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><Wallet size={18} className="text-primary" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-gray-900">Refund to DamnDeal Wallet</p>
            <p className="text-[11px] text-gray-500">Funds credited instantly after pickup & approval</p>
          </div>
          <span className="text-sm font-bold text-gray-900">₹{totalRefund.toFixed(0)}</span>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 rounded-md px-3 py-2 mb-3 flex items-center gap-2">
          <AlertCircle size={14} className="text-red-600 shrink-0" />
          <p className="text-[12px] text-red-700">{error}</p>
        </div>
      )}

      {/* Sticky submit bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-30">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="flex-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Refund</p>
            <p className="text-base font-bold text-gray-900">₹{totalRefund.toFixed(0)}</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || !hasSelection}
            className="flex-[2] py-3 rounded-md bg-primary text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? 'Submitting...' : (<><CheckCircle2 size={16} /> Request Return</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
