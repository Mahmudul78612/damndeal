'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api, imgUrl } from '@/lib/api';
import { Order } from '@/lib/types';
import { ChevronLeft, Package, Truck, CheckCircle, XCircle, Clock, ExternalLink, Download, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const statusSteps = ['pending', 'confirmed', 'shipped', 'out_for_delivery', 'delivered'];
const stepLabels = ['Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];
const stepIcons = [Package, Clock, Truck, Truck, CheckCircle];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const isSuccess = params.get('success') === '1';
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('changed_mind');
  const [cancelNote, setCancelNote] = useState('');

  useEffect(() => {
    api.get(`/user/orders/${id}`)
      .then(res => setOrder(res.order))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!order || ['delivered', 'cancelled'].includes(order.status)) return;
    const interval = setInterval(() => {
      api.get(`/user/orders/${id}`)
        .then(res => setOrder(res.order))
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [id, order?.status]);

  if (loading) return (
    <div className="px-4 py-4 space-y-3 animate-pulse">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-40 rounded-2xl" />
      <div className="skeleton h-60 rounded-2xl" />
    </div>
  );

  if (!order) return (
    <div className="text-center py-20">
      <p className="text-gray-400 text-lg">Order not found</p>
      <Link href="/orders" className="text-primary font-semibold mt-2 inline-block">View All Orders</Link>
    </div>
  );

  const currentIdx = statusSteps.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';
  const ship = order.shipping;
  const orderAgeMs = Date.now() - new Date(order.createdAt).getTime();
  const canCancel = ['placed', 'confirmed'].includes(order.status) && orderAgeMs <= 24 * 60 * 60 * 1000;

  const reasonLabelMap: Record<string, string> = {
    changed_mind: 'Changed my mind',
    ordered_by_mistake: 'Ordered by mistake',
    found_better_price: 'Found a better price',
    delivery_too_late: 'Delivery taking too long',
    want_to_modify: 'Want to modify order/address',
    other: 'Other',
  };

  const handleCancelOrder = async () => {
    if (!order || !canCancel || cancelling) return;

    const label = reasonLabelMap[cancelReason] || 'Cancelled by user';
    const note = cancelNote.trim();
    const reason = note ? `${label} - ${note}` : label;

    setCancelling(true);
    try {
      const res = await api.put(`/user/orders/${order._id}/cancel`, { reason });
      setOrder(res.order);
      setShowCancelModal(false);
      setCancelReason('changed_mind');
      setCancelNote('');
    } catch (e: any) {
      // Keep native alert only for hard API failure.
      window.alert(e?.message || 'Could not cancel order');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="px-4 py-4 md:px-6 max-w-3xl mx-auto pb-8">
      {/* Success banner */}
      {isSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-center gap-3">
          <CheckCircle className="text-green-500 shrink-0" size={24} />
          <div>
            <p className="text-sm font-bold text-green-800">Order placed successfully!</p>
            <p className="text-xs text-green-600">We&apos;ll notify you when it ships</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => window.history.back()} className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Order #{order.orderNumber}</h1>
          <p className="text-xs text-gray-400">
            {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      {/* Status timeline */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h2 className="text-sm font-bold text-gray-900 mb-4">Order Status</h2>
        {isCancelled ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <XCircle className="text-red-500" size={24} />
              <span className="text-red-600 font-bold">Order Cancelled</span>
            </div>
            {order.cancelReason && (
              <p className="text-xs text-red-500">Reason: {order.cancelReason}</p>
            )}
            {order.rejectedReason && (
              <p className="text-xs text-red-500">Admin note: {order.rejectedReason}</p>
            )}
          </div>
        ) : (
          <div className="space-y-0">
            {statusSteps.map((step, i) => {
              const done = i <= currentIdx;
              const Icon = stepIcons[i];
              return (
                <div key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${done ? 'bg-primary' : 'bg-gray-200'}`}>
                      <Icon size={16} className={done ? 'text-white' : 'text-gray-400'} />
                    </div>
                    {i < statusSteps.length - 1 && (
                      <div className={`w-0.5 h-8 ${i < currentIdx ? 'bg-primary' : 'bg-gray-200'}`} />
                    )}
                  </div>
                  <div className="pb-4">
                    <p className={`text-sm ${done ? 'font-bold text-gray-900' : 'text-gray-400'}`}>{stepLabels[i]}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {canCancel && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-500 mb-2">You can cancel this order within 24 hours of placing it.</p>
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={cancelling}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-60"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          </div>
        )}
      </div>

      {/* Courier tracking */}
      {ship?.awb && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Truck size={16} /> Courier Tracking
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Courier</span>
              <span className="font-medium">{ship.courierName || ship.provider}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">AWB</span>
              <span className="font-mono font-medium">{ship.awb}</span>
            </div>
            {ship.status && (
              <div className="flex justify-between">
                <span className="text-gray-500">Status</span>
                <span className="font-medium text-primary">{ship.status}</span>
              </div>
            )}
            {ship.estimatedDelivery && (
              <div className="flex justify-between">
                <span className="text-gray-500">ETA</span>
                <span className="font-medium">{new Date(ship.estimatedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>
            )}
          </div>

          {/* Tracking events */}
          {ship.events && ship.events.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-xs font-bold text-gray-700 mb-2">Shipment Updates</p>
              <div className="space-y-0">
                {[...ship.events].reverse().map((ev, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full ${i === 0 ? 'bg-primary' : 'bg-gray-300'}`} />
                      {i < ship.events!.length - 1 && <div className="w-0.5 h-8 bg-gray-200" />}
                    </div>
                    <div className="pb-2 min-w-0">
                      <p className={`text-xs ${i === 0 ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{ev.status}</p>
                      {ev.description && <p className="text-[11px] text-gray-400">{ev.description}</p>}
                      <p className="text-[11px] text-gray-400">
                        {ev.location ? `${ev.location} • ` : ''}
                        {new Date(ev.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ship.trackingUrl && (
            <a href={ship.trackingUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full mt-3 py-2.5 border border-primary text-primary rounded-xl text-sm font-semibold hover:bg-primary/5">
              <ExternalLink size={14} /> Track on Courier Website
            </a>
          )}
        </div>
      )}

      {/* Delivery Partner */}
      {order.deliveryBoy && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
          <h2 className="text-sm font-bold text-gray-900 mb-2">Delivery Partner</h2>
          <p className="text-sm text-gray-700 font-medium">{order.deliveryBoy.name}</p>
          <p className="text-xs text-gray-400">{order.deliveryBoy.phone}</p>
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Items ({order.items.length})</h2>
        <div className="space-y-3">
          {order.items.map((item, i) => {
            const img = item.product?.images?.[0] || item.image;
            return (
              <div key={i} className="flex gap-3 items-center">
                <div className="w-14 h-14 rounded-lg bg-gray-50 overflow-hidden relative shrink-0">
                  {img ? (
                    <Image src={imgUrl(img)} alt={item.name} fill className="object-cover" sizes="56px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-300" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{item.name}</p>
                  <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
                </div>
                <span className="text-sm font-bold text-gray-900 shrink-0">₹{item.total.toFixed(0)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bill */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900 mb-3">Payment Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{order.subtotal.toFixed(0)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Delivery</span><span>₹{order.deliveryFee}</span></div>
          {order.platformFee > 0 && <div className="flex justify-between"><span className="text-gray-500">Platform Fee</span><span>₹{order.platformFee}</span></div>}
          {order.discount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{order.discount}</span></div>}
          <div className="border-t border-gray-100 pt-2 flex justify-between">
            <span className="font-bold text-gray-900">Grand Total</span>
            <span className="font-bold text-lg text-gray-900">₹{order.grandTotal.toFixed(0)}</span>
          </div>
          <p className="text-xs text-gray-400">Payment: {order.paymentMethod?.toUpperCase()}</p>
        </div>
      </div>

      {/* Invoice download */}
      {order.status === 'delivered' && (
        <a
          href={`/proxy-api/user/orders/${order._id}/invoice`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3 mt-4 bg-white rounded-2xl shadow-sm text-sm font-semibold text-primary hover:bg-primary/5 transition"
        >
          <Download size={16} /> Download Invoice
        </a>
      )}

      {/* Return Item CTA */}
      {order.status === 'delivered' && (() => {
        const deliveredAt = order.deliveredAt || order.updatedAt;
        const ageDays = deliveredAt ? (Date.now() - new Date(deliveredAt).getTime()) / 86400000 : 0;
        const daysLeft = Math.max(0, Math.ceil(7 - ageDays));
        const expired = ageDays > 7;
        return (
          <div className="mt-3 border border-gray-200 rounded-md bg-white overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
              <h2 className="text-[12px] font-bold tracking-wide text-gray-700 uppercase">Need to return?</h2>
            </div>
            <div className="p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <RotateCcw size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900">7-day easy return</p>
                <p className="text-[11px] text-gray-500">
                  {expired ? 'Return window expired' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left • Refund to wallet`}
                </p>
              </div>
              {expired ? (
                <span className="text-[11px] font-semibold text-gray-400">Closed</span>
              ) : (
                <Link
                  href={`/returns/new/${order._id}`}
                  className="px-3 py-2 rounded-md bg-primary text-white text-[12px] font-bold whitespace-nowrap"
                >
                  Return Item
                </Link>
              )}
            </div>
          </div>
        );
      })()}

      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-3">
          <div className="w-full max-w-md bg-white rounded-2xl md:rounded-2xl p-4 shadow-xl">
            <h3 className="text-sm font-bold text-gray-900">Cancel Order</h3>
            <p className="text-xs text-gray-500 mt-1">Please select a reason for cancellation.</p>

            <div className="mt-3 space-y-2">
              <label className="text-[11px] font-semibold text-gray-600">Reason</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
              >
                <option value="changed_mind">Changed my mind</option>
                <option value="ordered_by_mistake">Ordered by mistake</option>
                <option value="found_better_price">Found a better price</option>
                <option value="delivery_too_late">Delivery taking too long</option>
                <option value="want_to_modify">Want to modify order/address</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="mt-3 space-y-2">
              <label className="text-[11px] font-semibold text-gray-600">Note (optional)</label>
              <textarea
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                rows={3}
                placeholder="Add more details"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary resize-none"
              />
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700"
              >
                Keep Order
              </button>
              <button
                onClick={handleCancelOrder}
                disabled={cancelling}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-60"
              >
                {cancelling ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
