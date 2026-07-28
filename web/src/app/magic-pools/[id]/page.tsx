'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  ChevronLeft, Crown, Gift, Sparkles, Trophy, Users,
  Ticket, CheckCircle2, Package, X, Loader2, AlertCircle,
} from 'lucide-react';

import { THEME_MAP } from '../page';
import { imgUrl } from '@/lib/api';

type ThemeKey = keyof typeof THEME_MAP;

type Pool = {
  _id: string;
  name: string;
  description?: string;
  prizeDescription?: string;
  prizePoints?: number;
  imageUrl?: string;
  images?: string[];
  tagline?: string;
  theme?: ThemeKey;
  capacity: number;
  participantsCount: number;
  seatsLeft: number;
  isFull: boolean;
  status: 'open' | 'drawing' | 'drawn' | 'cancelled';
  joined?: boolean;
  winner?: { user?: any; drawnAt?: string } | null;
  createdAt?: string;
};

type EligibleOrder = {
  _id: string;
  orderNumber?: string;
  grandTotal?: number;
  deliveredAt?: string;
  createdAt: string;
  items?: { name?: string; image?: string }[];
};

const WHEEL_COLORS = [
  '#f43f5e', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#eab308',
];

function WheelOfFortune({ spinning, slices = 8 }: { spinning: boolean; slices?: number }) {
  // Pure-CSS conic-gradient wheel.
  const stops = useMemo(() => {
    const step = 100 / slices;
    return Array.from({ length: slices }, (_, i) => {
      const c = WHEEL_COLORS[i % WHEEL_COLORS.length];
      return `${c} ${i * step}% ${(i + 1) * step}%`;
    }).join(', ');
  }, [slices]);

  return (
    <div className="relative w-56 h-56 mx-auto">
      {/* Outer ring of lights */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-[0_0_40px_rgba(251,191,36,0.6)]" />
      <div className="absolute inset-2 rounded-full bg-white" />

      {/* Wheel */}
      <div
        className={`absolute inset-4 rounded-full ${spinning ? 'animate-[spin_2.5s_cubic-bezier(0.2,0.8,0.2,1)_infinite]' : ''}`}
        style={{ background: `conic-gradient(${stops})` }}
      />

      {/* Center hub */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-14 h-14 rounded-full bg-white shadow-xl ring-4 ring-amber-400 flex items-center justify-center">
          <Crown size={26} className="text-amber-500" />
        </div>
      </div>

      {/* Pointer */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0
                      border-l-[14px] border-l-transparent
                      border-r-[14px] border-r-transparent
                      border-t-[22px] border-t-rose-600 drop-shadow-md" />
    </div>
  );
}

export default function MagicPoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();

  const [pool, setPool] = useState<Pool | null>(null);
  const [loading, setLoading] = useState(true);
  const [showJoin, setShowJoin] = useState(false);
  const [eligibleOrders, setEligibleOrders] = useState<EligibleOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string>('');
  const [joining, setJoining] = useState(false);
  const [joinErr, setJoinErr] = useState('');

  const loadPool = () => api.get(`/user/magic-pools/${id}`)
    .then((res) => setPool(res.pool))
    .catch(() => {});

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal(`/magic-pools/${id}`); return; }
    loadPool().finally(() => setLoading(false));
    // Light polling so the user sees the wheel/winner updates
    const t = setInterval(loadPool, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isLoggedIn, id]);

  const openJoinModal = async () => {
    setShowJoin(true);
    setJoinErr('');
    setSelectedOrder('');
    setLoadingOrders(true);
    try {
      // Pull user orders & user's pool entries to filter delivered + not already joined.
      const [ordersRes, mineRes] = await Promise.all([
        api.get('/user/orders'),
        api.get('/user/magic-pools/mine').catch(() => ({ pools: [] })),
      ]);
      const usedOrderIds = new Set(
        (mineRes.pools || []).map((p: any) => String(p.orderId)).filter(Boolean)
      );
      const orders = (ordersRes.orders || [])
        .filter((o: any) => o.status === 'delivered')
        .filter((o: any) => !usedOrderIds.has(String(o._id)));
      setEligibleOrders(orders);
      if (orders.length === 1) setSelectedOrder(orders[0]._id);
    } catch (e: any) {
      setJoinErr(e?.message || 'Could not load your orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  const submitJoin = async () => {
    if (!selectedOrder) { setJoinErr('Please select an order'); return; }
    setJoining(true);
    setJoinErr('');
    try {
      const res = await api.post(`/user/magic-pools/${id}/join`, { orderId: selectedOrder });
      setPool(res.pool);
      setShowJoin(false);
    } catch (e: any) {
      setJoinErr(e?.message || 'Could not join pool');
    } finally {
      setJoining(false);
    }
  };

  if (loading) return (
    <div className="px-4 py-4 space-y-3 animate-pulse">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-64 rounded-3xl" />
      <div className="skeleton h-32 rounded-2xl" />
    </div>
  );

  if (!pool) return (
    <div className="text-center py-20">
      <p className="text-gray-400">Pool not found</p>
      <Link href="/magic-pools" className="text-primary font-semibold mt-2 inline-block">All Pools</Link>
    </div>
  );

  const pct = Math.min(100, Math.round((pool.participantsCount / pool.capacity) * 100));
  const isWinner = pool.status === 'drawn' && pool.joined && pool.winner; // winner field exists; winner.user check happens server-side
  const showWheel = pool.status === 'drawing' || pool.status === 'drawn';
  const canJoin = pool.status === 'open' && !pool.joined && !pool.isFull;

  return (
    <div className="px-4 py-3 md:px-6 lg:px-8 max-w-6xl mx-auto pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-base md:text-xl font-bold text-gray-900 truncate">{pool.name}</h1>
      </div>

      {/* Desktop: 2-column hero — Image LEFT, info RIGHT. Mobile: stacked. Native feel: white card with subtle theme accent. */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-gray-200 shadow-sm">
        {/* Theme accent stripe at top */}
        <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${THEME_MAP[pool.theme || 'fuchsia'].grad}`} />

        <div className="grid lg:grid-cols-5 gap-0">
          {/* IMAGE COLUMN — 16:9 always */}
          {(() => {
            const allImages = [
              ...(pool.imageUrl ? [pool.imageUrl] : []),
              ...((pool.images || []).filter((u) => u !== pool.imageUrl)),
            ];
            if (!allImages.length) {
              return (
                <div className={`lg:col-span-3 relative aspect-[16/9] bg-gradient-to-br ${THEME_MAP[pool.theme || 'fuchsia'].grad} flex items-center justify-center`}>
                  <Crown size={88} className="text-white/70" />
                </div>
              );
            }
            if (allImages.length === 1) {
              return (
                <div className="lg:col-span-3 relative aspect-[16/9] bg-gray-100">
                  <Image src={imgUrl(allImages[0])} alt={pool.name} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 720px" priority />
                </div>
              );
            }
            return (
              <div className="lg:col-span-3 relative bg-gray-100">
                <div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide">
                  {allImages.map((u, i) => (
                    <div key={i} className="relative shrink-0 w-full aspect-[16/9] snap-center">
                      <Image src={imgUrl(u)} alt={`${pool.name} ${i + 1}`} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 720px" />
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">{i + 1}/{allImages.length}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* INFO COLUMN */}
          <div className="lg:col-span-2 p-4 md:p-5 lg:p-6 flex flex-col justify-center">
            {pool.tagline && (
              <div className={`text-[10px] md:text-xs font-bold uppercase tracking-widest ${THEME_MAP[pool.theme || 'fuchsia'].text} mb-1.5`}>{pool.tagline}</div>
            )}

            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <div className={`px-2 py-0.5 rounded-full ${THEME_MAP[pool.theme || 'fuchsia'].soft} flex items-center gap-1.5`}>
                <Trophy size={11} className={THEME_MAP[pool.theme || 'fuchsia'].text} />
                <span className={`text-[10px] font-bold uppercase tracking-wide ${THEME_MAP[pool.theme || 'fuchsia'].text}`}>Lucky Draw</span>
              </div>
              {pool.joined && (
                <div className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center gap-1">
                  <CheckCircle2 size={11} /> You're In
                </div>
              )}
            </div>

            <h2 className="text-xl md:text-2xl lg:text-2xl font-extrabold text-gray-900 leading-tight">{pool.name}</h2>
            {pool.description && <p className="text-sm text-gray-600 mt-1.5 leading-snug line-clamp-2">{pool.description}</p>}

            {/* Prize block */}
            {(pool.prizeDescription || pool.prizePoints) && (
              <div className={`mt-3 p-3 rounded-xl ${THEME_MAP[pool.theme || 'fuchsia'].soft} border border-gray-100`}>
                <div className={`flex items-center gap-1.5 ${THEME_MAP[pool.theme || 'fuchsia'].text} text-[10px] font-bold uppercase tracking-wider mb-0.5`}>
                  <Gift size={12} /> The Prize
                </div>
                {pool.prizeDescription && (
                  <p className="text-base md:text-lg font-extrabold text-gray-900 leading-tight">{pool.prizeDescription}</p>
                )}
                {!!pool.prizePoints && (
                  <p className="text-xs text-gray-600 mt-0.5">+ {pool.prizePoints} Magic Points</p>
                )}
              </div>
            )}

            {/* Progress */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-gray-700">
                  <Users size={13} />
                  <span className="text-xs md:text-sm font-bold">
                    {pool.participantsCount} / {pool.capacity} joined
                  </span>
                </div>
                <span className={`text-[11px] md:text-xs font-bold ${pool.isFull ? 'text-rose-600' : 'text-gray-500'}`}>
                  {pool.isFull ? 'FULL' : `${pool.seatsLeft} spots left`}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${THEME_MAP[pool.theme || 'fuchsia'].grad} transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* Inline desktop CTA */}
            <div className="hidden lg:block mt-4">
              {pool.joined ? (
                <div className="px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm font-bold flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} /> Ticket Booked
                </div>
              ) : canJoin ? (
                <button
                  onClick={openJoinModal}
                  className={`w-full py-2.5 rounded-xl bg-gradient-to-r ${THEME_MAP[pool.theme || 'fuchsia'].grad} text-white text-sm font-bold shadow-sm hover:shadow-md transition flex items-center justify-center gap-2`}
                >
                  <Ticket size={16} /> Grab My Ticket
                </button>
              ) : (
                <div className="px-4 py-2.5 rounded-xl bg-gray-50 text-gray-400 text-sm font-bold text-center">
                  {pool.isFull ? 'Pool is full' : pool.status === 'drawn' ? 'Draw complete' : 'Closed'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Below-hero: 2-col on desktop (wheel + how-it-works) */}
      <div className="grid lg:grid-cols-2 gap-3 md:gap-4 mt-3 md:mt-4">
        {/* Wheel of fortune section */}
        {showWheel ? (
          <div className="bg-white rounded-2xl p-5 border border-gray-200 text-center">
            <WheelOfFortune spinning={pool.status === 'drawing'} />
            {pool.status === 'drawing' && (
              <>
                <p className="mt-4 text-base font-bold text-gray-900">🎡 The wheel is spinning…</p>
                <p className="text-xs text-gray-500 mt-1">A random winner is being chosen right now</p>
              </>
            )}
            {pool.status === 'drawn' && (
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider text-gray-400 font-bold">Winner Drawn</p>
                <p className="mt-1 text-lg font-extrabold bg-gradient-to-r from-amber-500 to-rose-500 bg-clip-text text-transparent">
                  🏆 Lucky Winner Selected!
                </p>
                {pool.joined && (
                  <div className={`mt-3 p-3 rounded-2xl ${isWinner ? 'bg-gradient-to-r from-amber-100 to-rose-100 border-2 border-amber-300' : 'bg-gray-50'}`}>
                    <p className="text-sm font-bold">
                      {isWinner ? '🎉 Congratulations — that\'s YOU!' : 'Better luck next time! Try another pool.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Pre-draw teaser block on desktop only, to balance the grid */
          <div className="hidden lg:flex bg-white border border-gray-200 rounded-2xl p-5 flex-col items-center justify-center text-center">
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${THEME_MAP[pool.theme || 'fuchsia'].grad} flex items-center justify-center shadow-sm mb-2.5`}>
              <Crown size={32} className="text-white" />
            </div>
            <p className="text-sm font-extrabold text-gray-900">The wheel awaits</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">When the last seat is taken, the wheel spins automatically and one lucky winner is chosen.</p>
            {!pool.joined && canJoin && (
              <button onClick={openJoinModal} className={`mt-3 px-4 py-2 rounded-lg bg-gradient-to-r ${THEME_MAP[pool.theme || 'fuchsia'].grad} text-white text-xs font-bold shadow-sm hover:shadow transition`}>
                Join the pool
              </button>
            )}
          </div>
        )}

        {/* How it works */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-gray-200">
          <h3 className="text-sm md:text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-fuchsia-500" /> How it works
          </h3>
          <ol className="space-y-3 text-sm text-gray-700">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-fuchsia-100 text-fuchsia-600 font-bold text-xs flex items-center justify-center">1</span>
              <span>Order something on Damndeal & wait for delivery.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-pink-100 text-pink-600 font-bold text-xs flex items-center justify-center">2</span>
              <span>Once delivered, use that order to grab a ticket in any open pool.</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-100 text-purple-600 font-bold text-xs flex items-center justify-center">3</span>
              <span>When the last seat fills, the wheel spins and one winner takes the prize.</span>
            </li>
          </ol>
        </div>
      </div>

      {/* Status banners */}
      {pool.status === 'cancelled' && (
        <div className="mt-4 p-4 bg-gray-100 rounded-2xl flex items-center gap-3">
          <AlertCircle className="text-gray-500" />
          <p className="text-sm font-semibold text-gray-700">This pool was cancelled.</p>
        </div>
      )}

      {/* Sticky CTA — mobile only */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-100 px-4 py-3 lg:hidden">
        {pool.joined ? (
          <button disabled className="w-full py-3.5 rounded-2xl bg-emerald-50 text-emerald-700 text-sm font-bold flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> Ticket Booked
          </button>
        ) : canJoin ? (
          <button
            onClick={openJoinModal}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-sm font-extrabold shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            <Ticket size={18} /> Grab My Ticket
          </button>
        ) : (
          <button disabled className="w-full py-3.5 rounded-2xl bg-gray-100 text-gray-400 text-sm font-bold">
            {pool.isFull ? 'Pool is full' : pool.status === 'drawn' ? 'Draw complete' : 'Closed'}
          </button>
        )}
      </div>

      {/* Join modal */}
      {showJoin && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-3">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                <Ticket size={18} className="text-fuchsia-600" /> Pick an order
              </h3>
              <button onClick={() => setShowJoin(false)} className="p-1 rounded-lg hover:bg-gray-100">
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Each delivered order earns you one ticket. The order can only join one pool.
            </p>

            {loadingOrders ? (
              <div className="py-8 text-center"><Loader2 className="animate-spin inline" /></div>
            ) : eligibleOrders.length === 0 ? (
              <div className="py-8 text-center">
                <Package className="mx-auto text-gray-300 mb-2" size={36} />
                <p className="text-sm font-semibold text-gray-700">No eligible orders</p>
                <p className="text-xs text-gray-400 mt-1">All your delivered orders are already in pools, or you have none yet.</p>
                <Link href="/" className="mt-4 inline-block px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold">
                  Shop now
                </Link>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {eligibleOrders.map((o) => (
                  <label
                    key={o._id}
                    className={`flex items-center gap-3 p-3 rounded-2xl border-2 cursor-pointer transition ${
                      selectedOrder === o._id
                        ? 'border-fuchsia-500 bg-fuchsia-50'
                        : 'border-gray-100 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="order"
                      value={o._id}
                      checked={selectedOrder === o._id}
                      onChange={(e) => setSelectedOrder(e.target.value)}
                      className="accent-fuchsia-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        {o.orderNumber || `Order #${o._id.slice(-6).toUpperCase()}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {o.deliveredAt
                          ? `Delivered ${new Date(o.deliveredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`
                          : new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        {o.grandTotal ? ` • ₹${Math.round(o.grandTotal)}` : ''}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {joinErr && (
              <div className="mt-3 p-2 rounded-lg bg-rose-50 text-rose-600 text-xs flex items-center gap-2">
                <AlertCircle size={14} /> {joinErr}
              </div>
            )}

            <button
              onClick={submitJoin}
              disabled={!selectedOrder || joining || eligibleOrders.length === 0}
              className="w-full mt-4 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-pink-500 text-white text-sm font-extrabold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {joining ? <Loader2 className="animate-spin" size={16} /> : <Ticket size={16} />}
              {joining ? 'Joining…' : 'Confirm Ticket'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
