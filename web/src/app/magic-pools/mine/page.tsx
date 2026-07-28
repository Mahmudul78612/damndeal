'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { api, imgUrl } from '@/lib/api';
import { ChevronLeft, Ticket, Trophy, Crown, ChevronRight, Sparkles } from 'lucide-react';

type MyPool = {
  _id: string;
  name: string;
  description?: string;
  prizeDescription?: string;
  prizePoints?: number;
  imageUrl?: string;
  images?: string[];
  capacity: number;
  participantsCount: number;
  status: 'open' | 'drawing' | 'drawn' | 'cancelled';
  joinedAt?: string;
  orderId?: string;
  isWinner?: boolean;
  winnerDrawnAt?: string;
};

const statusBadge = (s: string) => {
  if (s === 'open') return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Live</span>;
  if (s === 'drawing') return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 animate-pulse">Spinning</span>;
  if (s === 'drawn') return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">Drawn</span>;
  return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{s}</span>;
};

export default function MyMagicPoolsPage() {
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const [pools, setPools] = useState<MyPool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/magic-pools/mine'); return; }
    api.get('/user/magic-pools/mine')
      .then((res) => setPools(res.pools || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, isLoggedIn, openLoginModal]);

  const wins = pools.filter((p) => p.isWinner);
  const active = pools.filter((p) => !p.isWinner && p.status !== 'drawn' && p.status !== 'cancelled');
  const past = pools.filter((p) => !p.isWinner && (p.status === 'drawn' || p.status === 'cancelled'));

  return (
    <div className="px-4 py-3 md:px-6 lg:px-8 max-w-6xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-3">
        <Link href="/magic-pools" className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-base md:text-lg font-bold text-gray-900">My Magic Pools</h1>
      </div>

      {/* Stats — soft, native, compact */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3 mb-4 md:mb-5">
        <div className="rounded-xl p-3 bg-white border border-gray-200">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fuchsia-600">
            <Ticket size={12} /> Tickets
          </div>
          <p className="text-2xl font-extrabold mt-0.5 text-gray-900">{pools.length}</p>
        </div>
        <div className="rounded-xl p-3 bg-white border border-gray-200">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-600">
            <Crown size={12} /> Wins
          </div>
          <p className="text-2xl font-extrabold mt-0.5 text-gray-900">{wins.length}</p>
        </div>
        <div className="rounded-xl p-3 bg-white border border-gray-200 hidden md:block">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
            <Sparkles size={12} /> Active
          </div>
          <p className="text-2xl font-extrabold mt-0.5 text-gray-900">{active.length}</p>
        </div>
        <div className="rounded-xl p-3 bg-white border border-gray-200 hidden md:block">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            <Trophy size={12} /> Past
          </div>
          <p className="text-2xl font-extrabold mt-0.5 text-gray-900">{past.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-gray-100" />)}
        </div>
      ) : pools.length === 0 ? (
        <div className="text-center py-16 md:py-20 bg-white rounded-2xl border border-gray-200">
          <div className="w-14 h-14 rounded-full bg-fuchsia-50 flex items-center justify-center mx-auto mb-3">
            <Ticket size={28} className="text-fuchsia-500" />
          </div>
          <p className="text-gray-800 font-semibold text-sm">No tickets yet</p>
          <p className="text-xs text-gray-500 mt-1 mb-4">Join a pool with one of your delivered orders</p>
          <Link href="/magic-pools" className="inline-block px-4 py-2 rounded-lg bg-gradient-to-r from-fuchsia-400 to-pink-400 text-white text-xs font-semibold shadow-sm hover:shadow transition">
            Browse Pools
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {wins.length > 0 && <Section title="Your Wins" pools={wins} accent="amber" />}
          {active.length > 0 && <Section title="Active Tickets" pools={active} accent="fuchsia" />}
          {past.length > 0 && <Section title="Past Pools" pools={past} accent="gray" muted />}
        </div>
      )}
    </div>
  );
}

function Section({ title, pools, accent, muted }: { title: string; pools: MyPool[]; accent: 'amber' | 'fuchsia' | 'gray'; muted?: boolean }) {
  return (
    <div>
      <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 px-0.5">{title}</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {pools.map((p) => <PoolCard key={p._id} p={p} accent={accent} muted={muted} />)}
      </div>
    </div>
  );
}

function PoolCard({ p, accent, muted }: { p: MyPool; accent: 'amber' | 'fuchsia' | 'gray'; muted?: boolean }) {
  const heroImg = p.imageUrl || (p.images && p.images[0]);
  const isWinner = p.isWinner;

  return (
    <Link
      href={`/magic-pools/${p._id}`}
      className={`group block rounded-xl overflow-hidden border transition ${
        isWinner
          ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50'
          : muted
            ? 'border-gray-200 bg-gray-50 hover:border-gray-300'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="flex md:block">
        {/* Image — 16:9 */}
        <div className={`relative shrink-0 w-32 md:w-full aspect-[16/9] ${heroImg ? 'bg-gray-100' : accent === 'amber' ? 'bg-gradient-to-br from-amber-200 to-orange-300' : accent === 'fuchsia' ? 'bg-gradient-to-br from-fuchsia-200 to-pink-300' : 'bg-gradient-to-br from-gray-200 to-gray-300'}`}>
          {heroImg ? (
            <Image src={imgUrl(heroImg)} alt={p.name} fill className="object-cover" sizes="(max-width: 768px) 128px, (max-width: 1024px) 50vw, 33vw" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {isWinner ? <Trophy size={32} className="text-white/90" /> : <Ticket size={32} className="text-white/90" />}
            </div>
          )}
          {isWinner && (
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-bold flex items-center gap-0.5">
              <Trophy size={9} /> WON
            </div>
          )}
          {p.status === 'drawing' && (
            <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-amber-400 text-amber-900 text-[9px] font-bold animate-pulse">SPINNING</div>
          )}
        </div>

        <div className="flex-1 min-w-0 p-3 md:p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-gray-900 truncate flex-1">{p.name}</p>
            {statusBadge(p.status)}
          </div>
          {p.prizeDescription && (
            <p className="text-xs text-gray-600 truncate">🎁 {p.prizeDescription}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <p className="text-[11px] text-gray-400">
              {p.participantsCount}/{p.capacity} joined
              {p.joinedAt && ` · ${new Date(p.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
            </p>
            <ChevronRight size={14} className="text-gray-300 group-hover:translate-x-0.5 group-hover:text-gray-500 transition" />
          </div>
          {isWinner && (
            <p className="mt-1.5 text-[11px] font-bold text-amber-700">🎉 You won this pool!</p>
          )}
        </div>
      </div>
    </Link>
  );
}
