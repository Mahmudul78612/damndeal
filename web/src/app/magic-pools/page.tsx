'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { api, imgUrl } from '@/lib/api';
import { Crown, Trophy, Users, Ticket, Gift, ChevronRight, Sparkles, Flame } from 'lucide-react';

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
};

type ThemeKey = 'fuchsia' | 'amber' | 'emerald' | 'sky' | 'violet' | 'rose' | 'cosmic' | 'gold';

export const THEME_MAP: Record<ThemeKey, { grad: string; text: string; ring: string; soft: string }> = {
  fuchsia: { grad: 'from-fuchsia-300 to-pink-300',   text: 'text-fuchsia-600', ring: 'ring-fuchsia-100', soft: 'bg-fuchsia-50' },
  amber:   { grad: 'from-amber-200 to-orange-300',   text: 'text-orange-600',  ring: 'ring-amber-100',   soft: 'bg-amber-50' },
  emerald: { grad: 'from-emerald-200 to-teal-300',   text: 'text-emerald-600', ring: 'ring-emerald-100', soft: 'bg-emerald-50' },
  sky:     { grad: 'from-sky-200 to-blue-300',       text: 'text-sky-600',     ring: 'ring-sky-100',     soft: 'bg-sky-50' },
  violet:  { grad: 'from-violet-300 to-indigo-300',  text: 'text-violet-600',  ring: 'ring-violet-100',  soft: 'bg-violet-50' },
  rose:    { grad: 'from-rose-200 to-pink-300',      text: 'text-rose-600',    ring: 'ring-rose-100',    soft: 'bg-rose-50' },
  cosmic:  { grad: 'from-purple-300 to-pink-300',    text: 'text-purple-700',  ring: 'ring-purple-100',  soft: 'bg-purple-50' },
  gold:    { grad: 'from-yellow-200 to-amber-300',   text: 'text-amber-700',   ring: 'ring-amber-100',   soft: 'bg-amber-50' },
};

/* ─── Compact row (mobile) ─────────────────────────────────────────── */
function PoolRow({ pool }: { pool: Pool }) {
  const theme = THEME_MAP[pool.theme || 'fuchsia'];
  const pct = Math.min(100, Math.round((pool.participantsCount / pool.capacity) * 100));
  const isDrawing = pool.status === 'drawing';
  const heroImg = pool.imageUrl || (pool.images && pool.images[0]);
  const hot = pct >= 70 && pool.status === 'open';

  return (
    <Link
      href={`/magic-pools/${pool._id}`}
      className="block bg-white border border-gray-200 hover:border-gray-300 hover:shadow-md rounded-xl p-3 transition-all group"
    >
      <div className="flex gap-3">
        <div className={`relative shrink-0 w-32 aspect-[16/9] rounded-lg overflow-hidden ${heroImg ? 'bg-gray-100' : `bg-gradient-to-br ${theme.grad}`}`}>
          {heroImg ? (
            <Image src={imgUrl(heroImg)} alt={pool.name} fill className="object-cover" sizes="128px" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Crown size={28} className="text-white/90 drop-shadow" />
            </div>
          )}
          {pool.joined && (
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-emerald-500 text-white text-[9px] font-bold">JOINED</div>
          )}
          {isDrawing && (
            <div className="absolute bottom-1 left-1 right-1 px-1 py-0.5 rounded bg-yellow-400 text-yellow-900 text-[9px] font-bold text-center animate-pulse">SPINNING</div>
          )}
          {hot && !pool.joined && !isDrawing && (
            <div className="absolute top-1 right-1 px-1 py-0.5 rounded bg-red-500 text-white text-[9px] font-bold flex items-center gap-0.5"><Flame size={9} />HOT</div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          {pool.tagline && (
            <span className={`text-[10px] font-bold uppercase tracking-wider ${theme.text} mb-0.5 truncate`}>{pool.tagline}</span>
          )}
          <h3 className="text-sm font-bold text-gray-900 leading-tight line-clamp-2">{pool.name}</h3>
          {pool.prizeDescription && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-600 line-clamp-1">
              <Gift size={11} className={theme.text} />
              <span className="truncate">{pool.prizeDescription}</span>
            </div>
          )}
          <div className="mt-auto pt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-gray-700 font-semibold flex items-center gap-1">
                <Users size={10} />
                {pool.participantsCount}/{pool.capacity}
                <span className="text-gray-300">·</span>
                <span className={pool.isFull ? 'text-red-600' : 'text-gray-500 font-normal'}>
                  {pool.isFull ? 'Full' : `${pool.seatsLeft} left`}
                </span>
              </span>
              <ChevronRight size={14} className="text-gray-400 group-hover:translate-x-0.5 group-hover:text-gray-600 transition" />
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full bg-gradient-to-r ${theme.grad} transition-all duration-700`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── Desktop card ─────────────────────────────────────────────────── */
function PoolCardDesktop({ pool }: { pool: Pool }) {
  const theme = THEME_MAP[pool.theme || 'fuchsia'];
  const pct = Math.min(100, Math.round((pool.participantsCount / pool.capacity) * 100));
  const isDrawing = pool.status === 'drawing';
  const heroImg = pool.imageUrl || (pool.images && pool.images[0]);
  const hot = pct >= 70 && pool.status === 'open';

  return (
    <Link
      href={`/magic-pools/${pool._id}`}
      className="group flex flex-col bg-white border border-gray-200 hover:border-gray-300 rounded-2xl overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
    >
      <div className={`relative w-full aspect-[16/9] ${heroImg ? 'bg-gray-100' : `bg-gradient-to-br ${theme.grad}`}`}>
        {heroImg ? (
          <Image src={imgUrl(heroImg)} alt={pool.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Crown size={64} className="text-white/90 drop-shadow-lg" />
          </div>
        )}

        {/* Top-left badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
          {pool.tagline && (
            <span className={`px-2 py-0.5 rounded-full bg-white/95 backdrop-blur-sm text-[10px] font-bold uppercase tracking-wider ${theme.text} shadow-sm`}>
              {pool.tagline}
            </span>
          )}
          {pool.joined && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
              <Ticket size={10} /> JOINED
            </span>
          )}
        </div>

        {/* Top-right badges */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 items-end">
          {hot && !pool.joined && !isDrawing && (
            <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-sm">
              <Flame size={10} /> HOT
            </span>
          )}
          {isDrawing && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-900 text-[10px] font-bold animate-pulse shadow-sm">
              🎡 SPINNING
            </span>
          )}
          {pool.isFull && pool.status === 'open' && (
            <span className="px-2 py-0.5 rounded-full bg-gray-900 text-white text-[10px] font-bold shadow-sm">FULL</span>
          )}
        </div>

        {/* Bottom prize ribbon */}
        {pool.prizeDescription && (
          <div className="absolute bottom-0 inset-x-0 p-2.5 bg-gradient-to-t from-black/85 via-black/55 to-transparent">
            <div className="flex items-center gap-1.5 text-yellow-300 text-[10px] font-bold uppercase tracking-wider mb-0.5">
              <Gift size={11} /> Prize
            </div>
            <p className="text-white text-sm font-bold leading-tight line-clamp-1 drop-shadow">{pool.prizeDescription}</p>
          </div>
        )}
      </div>

      <div className="p-3.5 flex-1 flex flex-col">
        <h3 className="text-base font-bold text-gray-900 leading-tight line-clamp-2 mb-2">{pool.name}</h3>

        <div className="mt-auto">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-gray-700 flex items-center gap-1">
              <Users size={12} className="text-gray-500" />
              {pool.participantsCount} / {pool.capacity} joined
            </span>
            <span className={`text-xs font-bold ${pool.isFull ? 'text-red-600' : pct >= 70 ? 'text-orange-600' : 'text-gray-500'}`}>
              {pool.isFull ? 'Full' : `${pool.seatsLeft} left`}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full bg-gradient-to-r ${theme.grad} transition-all duration-700`} style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[11px] text-gray-500">Join with a delivered order</span>
            <span className={`text-xs font-bold ${theme.text} flex items-center gap-0.5 group-hover:translate-x-0.5 transition`}>
              View <ChevronRight size={13} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function MagicPoolsPage() {
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/magic-pools'); return; }
    api.get('/user/magic-pools')
      .then((res) => setPools(res.pools || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, isLoggedIn, openLoginModal]);

  return (
    <div className="px-4 py-3 md:px-6 lg:px-8 max-w-7xl mx-auto pb-12">
      {/* Hero — soft, compact, native feel */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-50 via-pink-50 to-amber-50 border border-fuchsia-100 p-3.5 md:p-5 mb-3 md:mb-5">
        <Sparkles className="absolute top-3 right-3 text-fuchsia-200 hidden md:block" size={56} />

        <div className="relative z-10 flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-fuchsia-400 to-pink-400 flex items-center justify-center shrink-0 shadow-sm">
            <Crown size={20} className="md:hidden text-white" />
            <Crown size={24} className="hidden md:block text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-xl font-bold text-gray-900 leading-tight">Magic Pools</h1>
            <p className="text-[11px] md:text-xs text-gray-600 leading-snug">
              Join with a delivered order · Pool fills · Wheel spins · Winner takes all
            </p>
          </div>
          <Link
            href="/magic-pools/mine"
            className="px-3 py-1.5 md:px-3.5 md:py-2 rounded-lg bg-white border border-fuchsia-200 text-fuchsia-700 hover:bg-fuchsia-50 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
          >
            <Ticket size={13} /> <span className="hidden sm:inline">My Tickets</span><span className="sm:hidden">My</span>
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-sm md:text-lg font-bold text-gray-800 flex items-center gap-1.5">
          <Trophy size={16} className="text-amber-500" />
          Open Pools
        </h2>
        <span className="text-[11px] md:text-sm text-gray-500">{pools.length} active</span>
      </div>

      {loading ? (
        <>
          <div className="md:hidden space-y-2 animate-pulse">
            {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-gray-100" />)}
          </div>
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-pulse">
            {[...Array(6)].map((_, i) => <div key={i} className="h-64 rounded-2xl bg-gray-100" />)}
          </div>
        </>
      ) : pools.length === 0 ? (
        <div className="text-center py-16 md:py-24 bg-white rounded-2xl border border-gray-200">
          <div className="text-5xl md:text-7xl mb-3">🎰</div>
          <p className="text-gray-700 font-semibold text-sm md:text-lg">No pools open right now</p>
          <p className="text-[11px] md:text-sm text-gray-400 mt-1">Check back soon — new pools open every week</p>
        </div>
      ) : (
        <>
          {/* Mobile: compact rows */}
          <div className="md:hidden space-y-2">
            {pools.map((p) => <PoolRow key={p._id} pool={p} />)}
          </div>
          {/* Desktop: card grid */}
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {pools.map((p) => <PoolCardDesktop key={p._id} pool={p} />)}
          </div>
        </>
      )}
    </div>
  );
}
