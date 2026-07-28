'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { ChevronLeft, Crown, Clock, Package, CheckCircle2, Calendar, X, Search } from 'lucide-react';

type Club = {
  _id?: string;
  id?: string;
  referenceId?: string;
  totalRewards?: number;
  rewardPoints?: number;
  rewardAmount?: number;
  points?: number;
  amount?: number;
  status?: string;
  createdAt?: string;
};

function pointsOf(c: any) {
  return Number(c.totalRewards ?? c.rewardPoints ?? c.points ?? c.rewardAmount ?? c.amount ?? 0);
}

const DATE_PRESETS = [
  { key: 'all',   label: 'All time' },
  { key: '7d',    label: 'Last 7 days' },
  { key: '30d',   label: 'Last 30 days' },
  { key: '90d',   label: 'Last 90 days' },
  { key: 'custom', label: 'Custom' },
];

export default function MagicClubAllPage() {
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [preset, setPreset] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/magic-club/all'); return; }
    api.get('/user/magic-club')
      .then((r) => setClubs(r?.clubs || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, isLoggedIn, openLoginModal]);

  // Compute date range from preset
  const range = useMemo(() => {
    const now = Date.now();
    if (preset === 'all') return { from: null as Date | null, to: null as Date | null };
    if (preset === 'custom') {
      return {
        from: from ? new Date(from + 'T00:00:00') : null,
        to: to ? new Date(to + 'T23:59:59') : null,
      };
    }
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
    return { from: new Date(now - days * 24 * 60 * 60 * 1000), to: null };
  }, [preset, from, to]);

  const filtered = useMemo(() => {
    return clubs
      .filter((c) => {
        if (!c.createdAt) return true;
        const t = new Date(c.createdAt).getTime();
        if (range.from && t < range.from.getTime()) return false;
        if (range.to && t > range.to.getTime()) return false;
        return true;
      })
      .filter((c) => {
        if (!q.trim()) return true;
        const needle = q.trim().toLowerCase();
        const id = String(c._id || c.id || c.referenceId || '').toLowerCase();
        return id.includes(needle);
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [clubs, range, q]);

  const totalPts = filtered.reduce((s, c) => s + pointsOf(c), 0);
  const activeCount = filtered.filter((c) => (c.status || 'active').toLowerCase() === 'active').length;

  return (
    <div className="px-4 py-3 md:px-6 lg:px-8 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Link href="/magic-club" className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-base md:text-lg font-bold text-gray-900">All Reward Clubs</h1>
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 md:p-4 mb-3">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={14} className="text-gray-500" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Date filter</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                preset === p.key
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full mt-0.5 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by club ID…"
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-amber-400"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100">
              <X size={14} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-3">
        <div className="rounded-xl p-3 bg-white border border-gray-200">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Showing</p>
          <p className="text-xl font-extrabold text-gray-900">{filtered.length}</p>
        </div>
        <div className="rounded-xl p-3 bg-white border border-gray-200">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Active</p>
          <p className="text-xl font-extrabold text-gray-900">{activeCount}</p>
        </div>
        <div className="rounded-xl p-3 bg-white border border-gray-200">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Points</p>
          <p className="text-xl font-extrabold text-gray-900">{totalPts.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-sm font-semibold text-gray-700">No clubs match this filter</p>
          <p className="text-xs text-gray-500 mt-1">Try a wider date range</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
          {filtered.map((c, i) => {
            const pts = pointsOf(c);
            const status = (c.status || 'active').toLowerCase();
            const isActive = status === 'active';
            return (
              <div
                key={c._id || c.id || c.referenceId || i}
                className={`rounded-xl p-3 border ${isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-200'}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white ${
                    isActive
                      ? 'bg-gradient-to-br from-amber-300 to-orange-400'
                      : 'bg-gradient-to-br from-gray-300 to-gray-400'
                  }`}>
                    {isActive ? <Crown size={18} /> : <Clock size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-bold text-gray-900 truncate">
                        Club #{(c._id || c.id || c.referenceId || '').toString().slice(-6).toUpperCase() || `00${i + 1}`}
                      </p>
                      {isActive ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-0.5">
                          <CheckCircle2 size={9} /> Active
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 uppercase">{status}</span>
                      )}
                    </div>
                    {c.referenceId && (
                      <p className="text-[10px] text-gray-500 flex items-center gap-1 truncate">
                        <Package size={9} /> {String(c.referenceId).slice(-10).toUpperCase()}
                      </p>
                    )}
                    {c.createdAt && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-amber-600">+{pts.toLocaleString('en-IN')}</p>
                    <p className="text-[9px] text-gray-400 font-semibold">pts</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
