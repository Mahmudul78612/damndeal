'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { api, imgUrl } from '@/lib/api';
import { Order } from '@/lib/types';
import { Package, ChevronRight, ChevronLeft, Download, Search, X } from 'lucide-react';

const statusColors: Record<string, string> = {
  placed: 'bg-amber-50 text-amber-700 border-amber-200',
  confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
  processing: 'bg-orange-50 text-orange-700 border-orange-200',
  ready: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  shipped: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  out_for_delivery: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered: 'bg-green-50 text-green-700 border-green-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
  returned: 'bg-gray-50 text-gray-600 border-gray-200',
};

const statusLabels: Record<string, string> = {
  placed: 'Order Placed', confirmed: 'Confirmed', processing: 'Preparing',
  ready: 'Ready to Ship', shipped: 'Shipped', out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned',
};

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'placed', label: 'On the way' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'returned', label: 'Returned' },
];

const DATE_FILTERS = [
  { key: 'all', label: 'Anytime', days: 0 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '6m', label: 'Last 6 months', days: 183 },
  { key: '1y', label: 'Last 1 year', days: 365 },
  { key: 'older', label: 'Older', days: -1 },
];

export default function OrdersPage() {
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/orders'); return; }
    api.get('/user/orders')
      .then(res => setOrders(res.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, isLoggedIn, router]);

  const handleInvoice = (e: React.MouseEvent, orderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`/proxy-api/user/orders/${orderId}/invoice`, '_blank');
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    const dateCfg = DATE_FILTERS.find(d => d.key === dateFilter);
    const q = search.trim().toLowerCase();
    return orders.filter(o => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'placed') {
          if (['delivered', 'cancelled', 'returned'].includes(o.status)) return false;
        } else if (o.status !== statusFilter) return false;
      }
      if (dateCfg && dateCfg.days > 0) {
        const ageMs = now - new Date(o.createdAt).getTime();
        if (ageMs > dateCfg.days * 86400000) return false;
      } else if (dateCfg && dateCfg.days === -1) {
        const ageMs = now - new Date(o.createdAt).getTime();
        if (ageMs <= 365 * 86400000) return false;
      }
      if (q) {
        const hay = [o.orderNumber, ...o.items.map(i => i.name)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, dateFilter, search]);

  const hasActiveFilter = statusFilter !== 'all' || dateFilter !== 'all' || !!search.trim();
  const clearAll = () => { setStatusFilter('all'); setDateFilter('all'); setSearch(''); };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
            aria-label="Back"
            className="-ml-1 p-1.5 rounded hover:bg-gray-100 text-gray-700"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-base font-bold text-gray-900">My Orders</h1>
          <span className="text-xs text-gray-400 ml-1">{orders.length}</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-3 md:px-4 pt-3">
        <div className="flex flex-col md:flex-row gap-3">
          <aside className="hidden md:block w-60 shrink-0">
            <div className="bg-white rounded-md border border-gray-200 sticky top-16">
              <div className="px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-[12px] font-bold text-gray-700 tracking-wide uppercase">Filters</h2>
                {hasActiveFilter && (
                  <button onClick={clearAll} className="text-[11px] text-primary font-semibold hover:underline">Clear</button>
                )}
              </div>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Order Status</p>
                <div className="space-y-1.5">
                  {STATUS_FILTERS.map(s => (
                    <label key={s.key} className="flex items-center gap-2 cursor-pointer text-[13px] text-gray-700 hover:text-primary">
                      <input type="radio" name="status" checked={statusFilter === s.key} onChange={() => setStatusFilter(s.key)} className="accent-primary w-3.5 h-3.5" />
                      <span>{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Order Time</p>
                <div className="space-y-1.5">
                  {DATE_FILTERS.map(d => (
                    <label key={d.key} className="flex items-center gap-2 cursor-pointer text-[13px] text-gray-700 hover:text-primary">
                      <input type="radio" name="date" checked={dateFilter === d.key} onChange={() => setDateFilter(d.key)} className="accent-primary w-3.5 h-3.5" />
                      <span>{d.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-md border border-gray-200 flex items-center px-3 mb-2.5">
              <Search size={16} className="text-gray-400 shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search orders by item or order ID"
                className="flex-1 px-2 py-2.5 text-[13px] focus:outline-none bg-transparent placeholder:text-gray-400"
              />
              {search && (
                <button onClick={() => setSearch('')} className="p-1 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="md:hidden -mx-3 px-3 mb-2.5 overflow-x-auto scrollbar-hide">
              <div className="flex gap-1.5 pb-1 whitespace-nowrap">
                {STATUS_FILTERS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setStatusFilter(s.key)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ${statusFilter === s.key ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-200'}`}
                  >
                    {s.label}
                  </button>
                ))}
                <span className="w-px bg-gray-200 mx-1" />
                {DATE_FILTERS.filter(d => d.key !== 'older').map(d => (
                  <button
                    key={d.key}
                    onClick={() => setDateFilter(d.key)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border transition ${dateFilter === d.key ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-200'}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && (
              <div className="space-y-2.5">
                {[...Array(3)].map((_, i) => <div key={i} className="skeleton h-28 rounded-md" />)}
              </div>
            )}

            {!loading && orders.length === 0 && (
              <div className="bg-white rounded-md border border-gray-200 flex flex-col items-center justify-center py-16 px-4">
                <Package size={48} className="text-gray-300 mb-3" />
                <h2 className="text-base font-bold text-gray-900 mb-1">No orders yet</h2>
                <p className="text-sm text-gray-500 mb-4">Start shopping to see your orders here</p>
                <Link href="/" className="px-5 py-2 bg-primary text-white rounded text-sm font-semibold">Shop Now</Link>
              </div>
            )}

            {!loading && orders.length > 0 && filtered.length === 0 && (
              <div className="bg-white rounded-md border border-gray-200 flex flex-col items-center justify-center py-12 px-4">
                <Search size={36} className="text-gray-300 mb-3" />
                <p className="text-sm font-semibold text-gray-700 mb-1">No orders match your filters</p>
                <button onClick={clearAll} className="text-[12px] text-primary font-semibold hover:underline mt-2">Clear filters</button>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="space-y-2.5">
                {filtered.map(order => (
                  <Link key={order._id} href={`/orders/${order._id}`} className="block bg-white rounded-md border border-gray-200 hover:border-gray-300 transition">
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-1">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-sm border ${statusColors[order.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {statusLabels[order.status] || order.status.replace(/_/g, ' ').toUpperCase()}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex -space-x-2 shrink-0">
                          {order.items.slice(0, 3).map((item, i) => {
                            const img = item.product?.images?.[0] || item.image;
                            return (
                              <div key={i} className="w-14 h-14 rounded border border-gray-200 bg-gray-50 overflow-hidden relative" style={{ zIndex: 3 - i }}>
                                {img ? (
                                  <Image src={imgUrl(img)} alt={item.name} fill className="object-cover" sizes="56px" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Package size={16} className="text-gray-300" /></div>
                                )}
                              </div>
                            );
                          })}
                          {order.items.length > 3 && (
                            <div className="w-14 h-14 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                              +{order.items.length - 3}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-gray-800 truncate font-medium">{order.items.map(i => i.name).join(', ')}</p>
                          <p className="text-[11px] text-gray-500 mt-0.5">
                            {order.items.length} item{order.items.length > 1 ? 's' : ''} · ID: <span className="font-mono">#{order.orderNumber}</span>
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span className="text-[14px] font-bold text-gray-900">₹{order.grandTotal.toFixed(0)}</span>
                            <div className="flex items-center gap-3">
                              {order.status === 'delivered' && (
                                <button onClick={(e) => handleInvoice(e, order._id)} className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                                  <Download size={12} /> Invoice
                                </button>
                              )}
                              <ChevronRight size={16} className="text-gray-400" />
                            </div>
                          </div>
                        </div>
                      </div>
                      {order.shipping?.awb && (
                        <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-1.5 text-[11px] text-gray-500">
                          <Package size={11} />
                          <span>{order.shipping.courierName || order.shipping.provider}</span>
                          <span>· AWB: <span className="font-mono">{order.shipping.awb}</span></span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
