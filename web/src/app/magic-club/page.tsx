'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  Sparkles, Crown, Gift, ChevronLeft, TrendingUp, Wallet as WalletIcon,
  Package, Clock, CheckCircle2, Info, ArrowRight,
} from 'lucide-react';

type Wallet = {
  enabled: boolean;
  balance: number;
  redeemable: number;
};
type Club = {
  _id?: string;
  id?: string;
  referenceId?: string;
  orderId?: string;
  rewardAmount?: number;
  rewardPoints?: number;
  amount?: number;
  points?: number;
  status?: string;
  createdAt?: string;
  expiresAt?: string;
};

function pointsOf(c: any) {
  return Number(c.totalRewards ?? c.rewardPoints ?? c.points ?? c.rewardAmount ?? c.amount ?? 0);
}

export default function MagicClubPage() {
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/magic-club'); return; }
    Promise.all([
      api.get('/user/magic-club/wallet').catch(() => null),
      api.get('/user/magic-club').catch(() => null),
    ]).then(([w, c]) => {
      if (w) {
        setWallet({ enabled: w.enabled !== false, balance: w.balance || 0, redeemable: w.redeemable || 0 });
        if (w.enabled === false) setEnabled(false);
      }
      if (c?.clubs) setClubs(Array.isArray(c.clubs) ? c.clubs : []);
    }).finally(() => setLoading(false));
  }, [authLoading, isLoggedIn, openLoginModal]);

  const totalEarned = clubs.reduce((sum, c) => sum + pointsOf(c), 0);

  return (
    <div className="px-4 py-4 md:px-6 max-w-2xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/account" className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-base font-bold text-gray-900">Magic Club</h1>
      </div>

      {/* Hero — wallet balance card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-pink-500 p-6 text-white shadow-2xl">
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-yellow-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-rose-300/30 rounded-full blur-3xl" />
        <Sparkles className="absolute top-3 right-3 text-white/30" size={70} />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="px-2.5 py-1 rounded-full bg-white/25 backdrop-blur-sm flex items-center gap-1.5">
              <Crown size={12} />
              <span className="text-[10px] font-bold uppercase tracking-wide">Magic Club Member</span>
            </div>
          </div>

          {loading ? (
            <div className="h-20 animate-pulse bg-white/20 rounded-xl" />
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wider opacity-90 font-bold">Your Magic Points</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-5xl font-extrabold drop-shadow">{wallet?.balance?.toLocaleString('en-IN') || 0}</span>
                <span className="text-sm font-semibold opacity-90">pts</span>
              </div>

              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/25 backdrop-blur-sm">
                <WalletIcon size={14} />
                <span className="text-sm font-bold">
                  Worth ₹{wallet?.redeemable?.toFixed(2) || '0.00'}
                </span>
              </div>

              <p className="text-[11px] opacity-80 mt-3">
                💡 Use these points at checkout — 100 points = ₹1
              </p>
            </>
          )}
        </div>
      </div>

      {!enabled && !loading && (
        <div className="mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex gap-2">
          <Info size={16} className="shrink-0 mt-0.5" />
          <span>Magic Club rewards are currently paused. Check back soon!</span>
        </div>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="rounded-2xl p-4 bg-white shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold uppercase tracking-wide">
            <TrendingUp size={12} /> Lifetime Earned
          </div>
          <p className="text-xl font-extrabold mt-1 text-gray-900">{totalEarned.toLocaleString('en-IN')}</p>
          <p className="text-[10px] text-gray-400">across {clubs.length} club{clubs.length === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-2xl p-4 bg-white shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold uppercase tracking-wide">
            <Crown size={12} /> Active Clubs
          </div>
          <p className="text-xl font-extrabold mt-1 text-gray-900">{clubs.filter(c => (c.status || 'active').toLowerCase() === 'active').length}</p>
          <p className="text-[10px] text-gray-400">earning rewards</p>
        </div>
      </div>

      {/* CTA — Magic Pools */}
      <Link
        href="/magic-pools"
        className="mt-4 block relative overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 via-purple-600 to-pink-500 p-4 text-white shadow-lg active:scale-[0.99] transition"
      >
        <Sparkles className="absolute -top-2 -right-2 text-white/20" size={70} />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/40">
            <Gift size={22} className="text-yellow-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold">Try Magic Pools 🎰</p>
            <p className="text-[11px] text-white/90">Win bigger prizes with your delivered orders</p>
          </div>
          <ArrowRight size={18} />
        </div>
      </Link>

      {/* Clubs / reward history */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Your Reward Clubs</h2>
          {clubs.length > 2 && (
            <Link href="/magic-club/all" className="text-[11px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-0.5">
              View all <ArrowRight size={11} />
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-20 rounded-2xl" />)}
          </div>
        ) : clubs.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center border border-dashed border-gray-200">
            <div className="text-5xl mb-2">🎁</div>
            <p className="text-sm font-semibold text-gray-700">No reward clubs yet</p>
            <p className="text-[11px] text-gray-400 mt-1 mb-4">
              Place an order — when it&apos;s delivered, you earn a Magic Club with reward points!
            </p>
            <Link href="/" className="inline-block px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {clubs.slice(0, 2).map((c, i) => {
              const pts = pointsOf(c);
              const status = (c.status || 'active').toLowerCase();
              const isActive = status === 'active';
              return (
                <div
                  key={c._id || c.id || c.referenceId || i}
                  className={`rounded-2xl p-4 border ${isActive ? 'bg-white border-gray-100' : 'bg-gray-50 border-gray-200'} shadow-sm`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow ${
                      isActive
                        ? 'bg-gradient-to-br from-amber-400 to-orange-500'
                        : 'bg-gradient-to-br from-gray-300 to-gray-400'
                    }`}>
                      {isActive ? <Crown size={22} /> : <Clock size={22} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          Club #{(c._id || c.id || c.referenceId || '').toString().slice(-6).toUpperCase() || `00${i + 1}`}
                        </p>
                        {isActive ? (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                            <CheckCircle2 size={9} /> Active
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 uppercase">{status}</span>
                        )}
                      </div>
                      {c.referenceId && (
                        <p className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Package size={10} /> Order {String(c.referenceId).slice(-8).toUpperCase()}
                        </p>
                      )}
                      {c.createdAt && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Earned {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-extrabold bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                        +{pts.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[10px] text-gray-400 font-semibold">points</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {clubs.length > 2 && (
              <Link
                href="/magic-club/all"
                className="block w-full text-center py-3 rounded-2xl bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 text-sm font-bold transition"
              >
                View all {clubs.length} clubs →
              </Link>
            )}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="mt-6 bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" /> How Magic Club works
        </h3>
        <ol className="space-y-3 text-sm text-gray-700">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold text-xs flex items-center justify-center">1</span>
            <span><strong>Shop & receive</strong> — order anything on Damndeal and wait for delivery.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-white font-bold text-xs flex items-center justify-center">2</span>
            <span><strong>Auto-earn rewards</strong> — every delivered order creates a Magic Club with reward points credited to your wallet.</span>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white font-bold text-xs flex items-center justify-center">3</span>
            <span><strong>Redeem at checkout</strong> — use your points on the next order. <span className="font-bold">100 points = ₹1</span>.</span>
          </li>
        </ol>

        <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-100 text-[11px] text-amber-800 flex gap-2">
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>Points may be reversed if an order is cancelled or returned. Points never expire while your account is active.</span>
        </div>
      </div>
    </div>
  );
}
