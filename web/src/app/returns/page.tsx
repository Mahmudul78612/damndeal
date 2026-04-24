'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Package, ChevronRight, RotateCcw, CheckCircle2, XCircle, Clock, Wallet } from 'lucide-react';
import { api } from '@/lib/api';

type ReturnItem = {
  product: string;
  name: string;
  quantity: number;
  refundAmount: number;
};

type ReturnRequest = {
  _id: string;
  status: 'requested' | 'approved' | 'rejected' | 'refunded';
  reason: string;
  reviewNote?: string;
  refundTo: string;
  totalRefundAmount: number;
  items: ReturnItem[];
  order: { _id: string; orderNumber: string; grandTotal: number } | null;
  createdAt: string;
  reviewedAt?: string;
};

const statusConfig: Record<string, { label: string; cls: string; Icon: any }> = {
  requested: { label: 'Requested', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: Clock },
  approved:  { label: 'Approved',  cls: 'bg-blue-50 text-blue-700 border-blue-200',     Icon: CheckCircle2 },
  rejected:  { label: 'Rejected',  cls: 'bg-red-50 text-red-700 border-red-200',        Icon: XCircle },
  refunded:  { label: 'Refunded',  cls: 'bg-green-50 text-green-700 border-green-200',  Icon: Wallet },
};

export default function ReturnsPage() {
  return (
    <Suspense fallback={<div className="px-4 py-4 max-w-3xl mx-auto"><div className="skeleton h-8 w-40" /></div>}>
      <ReturnsPageInner />
    </Suspense>
  );
}

function ReturnsPageInner() {
  const params = useSearchParams();
  const justCreated = params.get('created') === '1';
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/user/returns')
      .then((res) => setReturns(res.returns || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-4 max-w-3xl mx-auto space-y-3 animate-pulse">
        <div className="skeleton h-8 w-40" />
        <div className="skeleton h-32 rounded-md" />
        <div className="skeleton h-32 rounded-md" />
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Returns</h1>
          <p className="text-[11px] text-gray-500">{returns.length} request{returns.length === 1 ? '' : 's'}</p>
        </div>
        <Link href="/orders" className="text-[12px] text-primary font-semibold">My Orders →</Link>
      </div>

      {justCreated && (
        <div className="border border-green-200 bg-green-50 rounded-md px-3 py-2.5 mb-4 flex items-start gap-2">
          <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-bold text-green-800">Return request submitted</p>
            <p className="text-[11px] text-green-700">Our team will review and arrange pickup shortly.</p>
          </div>
        </div>
      )}

      {returns.length === 0 ? (
        <div className="border border-gray-200 rounded-md bg-white py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 inline-flex items-center justify-center mb-3">
            <RotateCcw size={22} className="text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700">No return requests yet</p>
          <p className="text-[12px] text-gray-500 mt-1">You can return delivered items within 7 days</p>
          <Link href="/orders" className="inline-block mt-4 px-4 py-2 rounded-md bg-primary text-white text-xs font-bold">View My Orders</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {returns.map((r) => {
            const st = statusConfig[r.status] || statusConfig.requested;
            const Icon = st.Icon;
            return (
              <div key={r._id} className="border border-gray-200 rounded-md bg-white overflow-hidden">
                {/* Header strip */}
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Return for</p>
                    <p className="text-[12px] font-mono font-semibold text-gray-800 truncate">
                      #{r.order?.orderNumber || '—'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded border ${st.cls} flex items-center gap-1`}>
                    <Icon size={11} /> {st.label}
                  </span>
                </div>

                {/* Items preview */}
                <div className="p-3 space-y-2">
                  {r.items.slice(0, 3).map((it, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Package size={12} className="text-gray-400 shrink-0" />
                      <p className="text-[12px] text-gray-700 truncate flex-1">{it.name}</p>
                      <span className="text-[11px] text-gray-500 shrink-0">×{it.quantity}</span>
                    </div>
                  ))}
                  {r.items.length > 3 && (
                    <p className="text-[11px] text-gray-400">+{r.items.length - 3} more</p>
                  )}
                </div>

                {/* Reason */}
                <div className="px-3 pb-2">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide">Reason</p>
                  <p className="text-[12px] text-gray-700">{r.reason}</p>
                  {r.reviewNote && (
                    <p className="text-[11px] text-gray-500 mt-1">Note from team: {r.reviewNote}</p>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-gray-100 px-3 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wide">Refund {r.refundTo === 'wallet' ? 'to Wallet' : ''}</p>
                    <p className="text-sm font-bold text-gray-900">₹{r.totalRefundAmount?.toFixed(0)}</p>
                  </div>
                  {r.order && (
                    <Link href={`/orders/${r.order._id}`} className="text-[12px] text-primary font-semibold flex items-center gap-1">
                      View Order <ChevronRight size={12} />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
