'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, CURRENCY_SYMBOL } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Category } from '@/lib/types';
import {
  LayoutDashboard, TicketPlus, ScanLine, KeyRound, Package2, Check, X,
  Copy, RefreshCw, PauseCircle, PlayCircle, BadgePercent,
} from 'lucide-react';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Tab = 'dashboard' | 'campaigns' | 'create' | 'verify' | 'api' | 'packs';

export default function VendorPortal() {
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const [vendor, setVendor] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState<Tab>('dashboard');

  const loadVendor = useCallback(async () => {
    try {
      const r = await api.get('/coupons/vendor/me');
      setVendor(r.vendor);
    } catch {}
    setChecked(true);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/vendor'); setChecked(true); return; }
    loadVendor();
  }, [isLoggedIn, authLoading, loadVendor, openLoginModal]);

  if (authLoading || !checked) return <Center>Loading…</Center>;
  if (!isLoggedIn) return (
    <Center>
      <p className="font-bold text-gray-600 mb-4">Sign in to open your vendor portal</p>
      <button onClick={() => openLoginModal('/vendor')} className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm">Sign in</button>
    </Center>
  );
  if (!vendor) return <Onboard onDone={loadVendor} />;

  const tabs: { k: Tab; label: string; icon: React.ReactNode }[] = [
    { k: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
    { k: 'campaigns', label: 'My Coupons', icon: <BadgePercent size={16} /> },
    { k: 'create', label: 'Create Coupon', icon: <TicketPlus size={16} /> },
    { k: 'verify', label: 'Verify Code', icon: <ScanLine size={16} /> },
    { k: 'api', label: 'API Key', icon: <KeyRound size={16} /> },
    { k: 'packs', label: 'Buy Packs', icon: <Package2 size={16} /> },
  ];

  const active = tabs.find((t) => t.k === tab);

  return (
    <div className="bg-band min-h-screen">
      {/* ── Mobile: app-style sticky tab bar ── */}
      <div className="md:hidden sticky top-[58px] z-40 bg-white/97 backdrop-blur border-b border-gray-100">
        <div className="flex overflow-x-auto no-scrollbar px-2">
          {tabs.map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`shrink-0 flex flex-col items-center gap-1 px-4 py-2.5 text-[10.5px] font-extrabold border-b-2 transition ${
                tab === t.k ? 'text-primary border-primary' : 'text-gray-400 border-transparent'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto md:px-4 md:py-6 md:grid md:grid-cols-[240px_1fr] md:gap-6 md:items-start">
        {/* ── Desktop: Meta-style side panel ── */}
        <aside className="hidden md:block md:sticky md:top-24">
          <div className="bg-white rounded-2xl border border-[#F0E9FA] shadow-[0_2px_12px_-6px_rgba(91,33,182,0.12)] overflow-hidden">
            <div className="relative p-4 pb-3.5 border-b border-gray-50">
              <div className="absolute top-0 left-0 right-0 h-1 brand-grad" />
              <p className="font-extrabold text-[15px] text-ink truncate mt-1">{vendor.businessName}</p>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary-light text-primary">
                  {vendor.claimCredits?.toLocaleString()} credits
                </span>
                {vendor.status !== 'approved' && (
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{vendor.status}</span>
                )}
              </div>
            </div>
            <nav className="p-2">
              {tabs.map((t) => (
                <button key={t.k} onClick={() => setTab(t.k)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-bold text-left transition mb-0.5 ${
                    tab === t.k
                      ? 'bg-primary-light text-primary shadow-[inset_3px_0_0_#7C3AED]'
                      : 'text-gray-500 hover:bg-band hover:text-ink'}`}>
                  <span className={tab === t.k ? 'text-primary' : 'text-gray-400'}>{t.icon}</span>
                  {t.label}
                  {t.k === 'campaigns' && tab !== t.k && <span className="ml-auto text-[10px] text-gray-300">›</span>}
                </button>
              ))}
            </nav>
            <div className="p-3 pt-1">
              <button onClick={() => setTab('create')} className="btn-claim w-full py-2.5 text-[13px]">
                <span className="relative z-10">+ New Coupon</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ── Content ── */}
        <main className="px-3 md:px-0 py-4 md:py-0 min-w-0">
          <div className="hidden md:flex items-center gap-2 mb-5">
            <span className="text-primary">{active?.icon}</span>
            <h1 className="text-[20px] font-extrabold text-ink">{active?.label}</h1>
          </div>
          {tab === 'dashboard' && <Dashboard />}
          {tab === 'campaigns' && <Campaigns goCreate={() => setTab('create')} />}
          {tab === 'create' && <CreateCampaign credits={vendor.claimCredits} onCreated={() => { setTab('campaigns'); loadVendor(); }} />}
          {tab === 'verify' && <Verify />}
          {tab === 'api' && <ApiKey vendor={vendor} onRotated={loadVendor} />}
          {tab === 'packs' && <Packs onOrdered={loadVendor} />}
        </main>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="py-28 text-center text-gray-400">{children}</div>;
}
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-gray-200 rounded-2xl p-5 ${className}`}>{children}</div>;
}
const inputCls = 'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
const labelCls = 'block text-[12px] font-bold text-gray-500 mb-1.5 mt-4 first:mt-0';

/* ── Onboarding ── */
function Onboard({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ businessName: '', description: '', website: '', phone: '', email: '', address: '', logo: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.businessName.trim()) { setError('Business name is required'); return; }
    setLoading(true); setError('');
    try { await api.post('/coupons/vendor/register', form); onDone(); }
    catch (e: any) { setError(e.message || 'Failed'); }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-extrabold">Set up your business</h1>
      <p className="text-sm text-gray-400 mt-1 mb-6">Free to start — you get 50 coupon credits instantly.</p>
      <Card>
        <label className={labelCls}>Business name *</label>
        <input className={inputCls} value={form.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="e.g. Brew & Co Café" />
        <label className={labelCls}>Short description</label>
        <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What do you do?" />
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Phone</label><input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
          <div><label className={labelCls}>Email</label><input className={inputCls} value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
        </div>
        <label className={labelCls}>Website (optional)</label>
        <input className={inputCls} value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
        <label className={labelCls}>Address / area</label>
        <input className={inputCls} value={form.address} onChange={(e) => set('address', e.target.value)} />
        <label className={labelCls}>Business logo (max 200 KB)</label>
        <input type="file" accept="image/*" className="text-sm" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          if (file.size > 200 * 1024) { setError('Logo must be under 200 KB'); return; }
          try { const fd = new FormData(); fd.append('images', file);
            const r = await api.upload('/coupons/upload', fd);
            if (r.files?.[0]) { set('logo', r.files[0]); setError(''); } } catch (err) { setError((err as Error).message); }
        }} />
        {form.logo && <p className="text-[11px] text-emerald-600 mt-1">✓ Logo uploaded</p>}
        {error && <p className="text-red-500 text-xs mt-3">{error}</p>}
        <button onClick={submit} disabled={loading}
          className="w-full mt-5 py-3 bg-primary text-white rounded-xl font-extrabold text-sm hover:bg-primary-dark disabled:opacity-50">
          {loading ? 'Creating…' : 'Create business profile'}
        </button>
      </Card>
    </div>
  );
}

/* ── Dashboard ── */
function Dashboard() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { api.get('/coupons/vendor/stats').then(setData).catch(() => {}); }, []);
  const s = data?.stats;
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['Coupons listed', s?.campaigns], ['Claims', s?.claims],
          ['Redeemed', s?.redeemed], ['Redemption rate', s ? `${s.redemptionRate}%` : '—'],
        ].map(([l, v]) => (
          <Card key={l as string}><p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{l}</p>
            <p className="text-2xl font-extrabold mt-1">{v ?? '—'}</p></Card>
        ))}
      </div>
      <Card className="mt-4">
        <p className="font-bold text-sm mb-3">Recent claims</p>
        {!data?.recent?.length ? <p className="text-sm text-gray-400">No claims yet.</p> : (
          <div className="space-y-2">
            {data.recent.map((r: any) => (
              <div key={r._id} className="flex items-center gap-3 text-[13px] border-b border-gray-50 pb-2 last:border-0">
                <span className="font-mono font-bold">{r.code}</span>
                <span className="text-gray-400 truncate flex-1">{r.campaign?.title}</span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${r.status === 'redeemed' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary-light text-primary'}`}>{r.status}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Campaign list ── */
function Campaigns({ goCreate }: { goCreate: () => void }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => api.get('/coupons/vendor/campaigns').then((r) => setItems(r.items || [])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const act = async (id: string, action: string) => {
    await api.patch(`/coupons/vendor/campaigns/${id}`, { action }); load();
  };
  const badge: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700', pending: 'bg-amber-100 text-amber-700',
    paused: 'bg-gray-100 text-gray-500', rejected: 'bg-red-100 text-red-600',
    expired: 'bg-gray-100 text-gray-400', draft: 'bg-gray-100 text-gray-500',
  };
  if (loading) return <Center>Loading…</Center>;
  if (!items.length) return (
    <Center>
      <p className="font-bold text-gray-600 mb-4">No coupons yet</p>
      <button onClick={goCreate} className="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-sm">Create your first coupon</button>
    </Center>
  );
  return (
    <div className="space-y-3">
      {items.map((c) => (
        <Card key={c._id} className="flex items-center gap-4 flex-wrap">
          <div className="w-16 text-center shrink-0">
            <p className="text-primary font-extrabold text-[15px] leading-tight">{c.offerText}</p>
          </div>
          <div className="flex-1 min-w-[180px]">
            <p className="font-bold text-[14px]">{c.title}</p>
            <p className="text-[12px] text-gray-400">{c.category?.name} · {c.claimedCount}/{c.totalQuota} claimed · {c.redeemedCount} redeemed · ends {new Date(c.endAt).toLocaleDateString()}</p>
            {c.status === 'rejected' && c.rejectReason && <p className="text-[12px] text-red-500 mt-0.5">Reason: {c.rejectReason}</p>}
          </div>
          <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${badge[c.status] || ''}`}>{c.status}</span>
          {c.status === 'active' && <button onClick={() => act(c._id, 'pause')} title="Pause" className="p-2 text-gray-400 hover:text-amber-500"><PauseCircle size={19} /></button>}
          {c.status === 'paused' && <button onClick={() => act(c._id, 'resume')} title="Resume" className="p-2 text-gray-400 hover:text-emerald-500"><PlayCircle size={19} /></button>}
        </Card>
      ))}
    </div>
  );
}

/* ── Create campaign — Meta-Ads-style step wizard ── */
const WIZ_STEPS = ['Offer', 'Details', 'Creative', 'Location', 'Review'];

function CreateCampaign({ credits, onCreated }: { credits: number; onCreated: () => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [states, setStates] = useState<string[]>([]);
  const [form, setForm] = useState<any>({
    title: '', category: '', offerType: 'percent', offerValue: '', offerText: '',
    description: '', instructions: '', terms: '', bannerImage: '',
    isOnline: false, redirectUrl: '', totalQuota: 50, perUserLimit: 1,
    endAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    nationwide: false, locStates: [] as string[], city: '', lat: null as number | null, lng: null as number | null, radiusKm: 10,
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    api.get('/coupons/categories').then((r) => setCats(r.items || [])).catch(() => {});
    import('@/lib/states').then((m) => import('@/lib/api').then((a) => setStates(m.statesFor(a.getRegion()))));
  }, []);

  const uploadBanner = async (file: File) => {
    if (file.size > 200 * 1024) { setMsg({ ok: false, text: 'Image must be under 200 KB — compress it and retry.' }); return; }
    try {
      const fd = new FormData(); fd.append('images', file);
      const r = await api.upload('/coupons/upload', fd);
      if (r.files?.[0]) { set('bannerImage', r.files[0]); setMsg(null); }
    } catch (e: any) { setMsg({ ok: false, text: e.message }); }
  };

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => { set('lat', p.coords.latitude); set('lng', p.coords.longitude); },
      () => setMsg({ ok: false, text: 'Location access denied — select states instead.' }),
      { timeout: 8000 }
    );
  };

  // Per-step validation (Meta-style: can't advance until the step is complete)
  const stepError = (): string => {
    if (step === 0) {
      if (!form.title.trim()) return 'Coupon title likho';
      if (!form.category) return 'Category chuno';
      if (!form.offerText.trim()) return 'Offer display text likho (e.g. "30% OFF")';
    }
    if (step === 3) {
      if (!form.nationwide && !form.locStates.length && form.lat == null) return 'Nationwide ya kam se kam ek state / apni location chuno';
      if (form.isOnline && !form.redirectUrl.trim()) return 'Online offer ke liye website URL do';
    }
    if (step === 4) {
      if (!form.totalQuota || form.totalQuota < 1) return 'Quota 1+ hona chahiye';
      if (form.totalQuota > credits) return `Sirf ${credits} credits hain — quota kam karo ya pack kharido`;
      if (!form.endAt) return 'End date chuno';
    }
    return '';
  };
  const next = () => { const e = stepError(); if (e) { setMsg({ ok: false, text: e }); return; } setMsg(null); setStep((s) => Math.min(4, s + 1)); };
  const back = () => { setMsg(null); setStep((s) => Math.max(0, s - 1)); };

  const submit = async () => {
    const e = stepError(); if (e) { setMsg({ ok: false, text: e }); return; }
    setLoading(true); setMsg(null);
    try {
      await api.post('/coupons/vendor/campaigns', {
        ...form,
        endAt: new Date(form.endAt + 'T23:59:59'),
        location: {
          nationwide: form.nationwide, states: form.locStates, city: form.city,
          lat: form.lat, lng: form.lng, radiusKm: form.radiusKm,
        },
      });
      setMsg({ ok: true, text: '🎉 Submitted! Review ke baad live ho jayega.' });
      setTimeout(onCreated, 1400);
    } catch (e: any) { setMsg({ ok: false, text: e.message || 'Failed to create' }); }
    setLoading(false);
  };

  const toggleState = (s: string) =>
    set('locStates', form.locStates.includes(s) ? form.locStates.filter((x: string) => x !== s) : [...form.locStates, s].slice(0, 10));

  /* Live card preview (tile style) */
  const Preview = () => (
    <div className="w-[150px] shrink-0">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg">
        {form.bannerImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/uploads/${form.bannerImage.replace(/^\/?uploads\//, '')}`} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full brand-grad flex flex-col items-center justify-center gap-1 p-2">
            <span className="text-white font-extrabold text-[15px] text-center leading-tight drop-shadow">{form.offerText || 'YOUR OFFER'}</span>
          </div>
        )}
      </div>
      <p className="font-extrabold text-[11px] text-ink mt-1.5 truncate">Your business</p>
      <p className="text-[12px] font-extrabold text-emerald-600">{form.offerText || '—'}</p>
      <p className="text-[9.5px] text-gray-400 mt-0.5">Live preview</p>
    </div>
  );

  return (
    <div className="max-w-3xl">
      {/* Step header */}
      <div className="flex items-center gap-0 mb-7 overflow-x-auto no-scrollbar">
        {WIZ_STEPS.map((label, i) => (
          <div key={label} className="flex items-center shrink-0">
            <button onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12.5px] font-extrabold transition ${
                i === step ? 'bg-primary text-white' : i < step ? 'text-emerald-600' : 'text-gray-300'}`}>
              <span className={`w-5 h-5 rounded-full grid place-items-center text-[10.5px] ${
                i === step ? 'bg-white/25' : i < step ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                {i < step ? <Check size={11} /> : i + 1}
              </span>
              {label}
            </button>
            {i < 4 && <span className={`w-6 h-0.5 mx-0.5 rounded ${i < step ? 'bg-emerald-300' : 'bg-gray-100'}`} />}
          </div>
        ))}
      </div>

      <Card>
        {/* STEP 1 — Offer */}
        {step === 0 && (
          <div className="fade-up">
            <p className="font-extrabold text-[16px] mb-1">Kya offer de rahe ho?</p>
            <p className="text-[12.5px] text-gray-400 mb-4">Basic offer info — yahi card pe sabse bada dikhta hai.</p>
            <label className={labelCls}>Coupon title *</label>
            <input className={inputCls} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. 30% OFF annual gym membership" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Category *</label>
                <select className={inputCls} value={form.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="">Select…</option>
                  {cats.map((c) => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Offer type</label>
                <select className={inputCls} value={form.offerType} onChange={(e) => set('offerType', e.target.value)}>
                  <option value="percent">% off</option><option value="flat">Flat amount off</option>
                  <option value="bogo">Buy 1 Get 1</option><option value="freebie">Free item/service</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Display text * <span className="font-normal text-gray-400">(card pe bada)</span></label>
                <input className={inputCls} value={form.offerText} onChange={(e) => set('offerText', e.target.value)} placeholder='"30% OFF" / "Buy 1 Get 1"' />
              </div>
              <div>
                <label className={labelCls}>Value (number, optional)</label>
                <input type="number" className={inputCls} value={form.offerValue} onChange={(e) => set('offerValue', e.target.value)} placeholder="30" />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 — Details */}
        {step === 1 && (
          <div className="fade-up">
            <p className="font-extrabold text-[16px] mb-1">Customer ko kya batana hai?</p>
            <p className="text-[12.5px] text-gray-400 mb-4">Description, redeem steps aur terms — detail page pe dikhte hain.</p>
            <label className={labelCls}>Description</label>
            <textarea className={inputCls} rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Customer ko kya milega, short mein…" />
            <label className={labelCls}>How to redeem (ek step per line)</label>
            <textarea className={inputCls} rows={3} value={form.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder={'Counter par QR dikhao\nStaff code verify karega\nOffer turant apply'} />
            <label className={labelCls}>Terms & conditions</label>
            <textarea className={inputCls} rows={2} value={form.terms} onChange={(e) => set('terms', e.target.value)} placeholder="One per customer. Not valid with other offers…" />
          </div>
        )}

        {/* STEP 3 — Creative */}
        {step === 2 && (
          <div className="fade-up">
            <p className="font-extrabold text-[16px] mb-1">Creative — banner lagao</p>
            <p className="text-[12.5px] text-gray-400 mb-4">3:4 portrait best lagta hai (tile grid). Max 200 KB. Nahi lagaya to branded gradient dikhega.</p>
            <div className="flex gap-6 items-start flex-wrap">
              <div className="flex-1 min-w-[220px]">
                <label className={labelCls}>Banner image (≤200 KB)</label>
                <input type="file" accept="image/*" className="text-sm" onChange={(e) => e.target.files?.[0] && uploadBanner(e.target.files[0])} />
                {form.bannerImage && (
                  <button onClick={() => set('bannerImage', '')} className="block mt-2 text-[11.5px] font-bold text-red-500">✕ Remove banner</button>
                )}
                <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
                  Tip: apna product/shop ki photo + bada offer text wala banner sabse zyada clicks laata hai.
                </p>
              </div>
              <Preview />
            </div>
          </div>
        )}

        {/* STEP 4 — Location */}
        {step === 3 && (
          <div className="fade-up">
            <p className="font-extrabold text-[16px] mb-1">Kahan dikhna chahiye?</p>
            <p className="text-[12.5px] text-gray-400 mb-4">Local business apne area mein hi dikhta hai — doosre state ke customers ko nahi.</p>

            <label className="flex items-center gap-2.5 bg-band rounded-xl px-4 py-3 cursor-pointer">
              <input type="checkbox" checked={form.nationwide} onChange={(e) => set('nationwide', e.target.checked)} />
              <span className="text-[13.5px] font-bold text-ink">🌐 Nationwide — poore region mein dikhao <span className="font-normal text-gray-400">(online brands ke liye)</span></span>
            </label>

            {!form.nationwide && (
              <>
                <label className={labelCls}>Select states (max 10) — {form.locStates.length} selected</label>
                <div className="flex flex-wrap gap-1.5 max-h-[150px] overflow-y-auto border border-gray-100 rounded-xl p-2.5">
                  {states.map((s) => (
                    <button key={s} onClick={() => toggleState(s)}
                      className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold border transition ${form.locStates.includes(s) ? 'bg-primary text-white border-primary' : 'bg-white text-gray-500 border-gray-200 hover:border-primary'}`}>
                      {s}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>City (optional)</label>
                    <input className={inputCls} value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="e.g. Patiala" />
                  </div>
                  <div>
                    <label className={labelCls}>Service radius (km)</label>
                    <input type="number" className={inputCls} value={form.radiusKm} onChange={(e) => set('radiusKm', parseInt(e.target.value) || 0)} />
                  </div>
                </div>
                <button onClick={useMyLocation}
                  className={`mt-3 flex items-center gap-2 text-[12.5px] font-extrabold px-4 py-2 rounded-full border transition ${form.lat != null ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-primary border-primary/30 hover:bg-primary-light'}`}>
                  📍 {form.lat != null ? `Location pinned ✓ (${form.lat.toFixed(3)}, ${form.lng?.toFixed(3)})` : 'Pin my shop location (for "Near me")'}
                </button>
              </>
            )}

            <div className="mt-5 pt-4 border-t border-gray-100">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={form.isOnline} onChange={(e) => { set('isOnline', e.target.checked); if (e.target.checked) set('nationwide', true); }} />
                <span className="text-[13.5px] font-bold text-ink">💻 Online offer — code meri website pe use hoga</span>
              </label>
              {form.isOnline && (
                <>
                  <label className={labelCls}>Website / offer URL *</label>
                  <input className={inputCls} value={form.redirectUrl} onChange={(e) => set('redirectUrl', e.target.value)} placeholder="https://yoursite.com/offer" />
                </>
              )}
            </div>
          </div>
        )}

        {/* STEP 5 — Quota + Review */}
        {step === 4 && (
          <div className="fade-up">
            <p className="font-extrabold text-[16px] mb-1">Quota & schedule — phir review</p>
            <p className="text-[12.5px] text-gray-400 mb-4">Aapke paas <b className="text-primary">{credits}</b> coupon credits hain.</p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Coupons (quota) *</label>
                <input type="number" className={inputCls} value={form.totalQuota} onChange={(e) => set('totalQuota', parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label className={labelCls}>Per user limit</label>
                <input type="number" className={inputCls} value={form.perUserLimit} onChange={(e) => set('perUserLimit', parseInt(e.target.value) || 1)} />
              </div>
              <div>
                <label className={labelCls}>Valid till *</label>
                <input type="date" className={inputCls} value={form.endAt} onChange={(e) => set('endAt', e.target.value)} />
              </div>
            </div>

            {/* Review summary */}
            <div className="mt-5 bg-band rounded-2xl p-4 flex gap-5 flex-wrap items-start">
              <Preview />
              <div className="flex-1 min-w-[200px] text-[13px] space-y-1.5">
                <p><b className="text-ink">{form.title || '—'}</b></p>
                <p className="text-gray-500">{cats.find((c) => c._id === form.category)?.name || '—'} · <span className="text-emerald-600 font-extrabold">{form.offerText}</span></p>
                <p className="text-gray-500">📍 {form.nationwide ? 'Nationwide' : [form.locStates.join(', ') || null, form.city || null, form.lat != null ? 'pinned' : null].filter(Boolean).join(' · ') || 'Not set'}</p>
                <p className="text-gray-500">🎟️ {form.totalQuota} coupons · {form.perUserLimit}/user · till {form.endAt}</p>
                {form.isOnline && <p className="text-gray-500">💻 Online → {form.redirectUrl || '—'}</p>}
              </div>
            </div>
          </div>
        )}

        {msg && <p className={`text-sm mt-4 font-bold ${msg.ok ? 'text-emerald-600' : 'text-red-500'}`}>{msg.text}</p>}

        {/* Nav buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <button onClick={back} disabled={step === 0}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold text-[13px] disabled:opacity-30">
            ← Back
          </button>
          {step < 4 ? (
            <button onClick={next} className="px-7 py-2.5 rounded-xl bg-primary text-white font-extrabold text-[13.5px] hover:bg-primary-dark">
              Next: {WIZ_STEPS[step + 1]} →
            </button>
          ) : (
            <button onClick={submit} disabled={loading} className="btn-claim px-8 py-3 text-[14px]">
              <span className="relative z-10">{loading ? 'Submitting…' : '🚀 Submit for review'}</span>
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
/* ── Verify / redeem ── */
function Verify() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [done, setDone] = useState('');

  const check = async () => {
    setLoading(true); setResult(null); setDone('');
    try { setResult(await api.post('/coupons/vendor/verify', { code })); }
    catch (e: any) { setResult({ valid: false, error: e.message || 'Not found' }); }
    setLoading(false);
  };
  const redeem = async () => {
    setRedeeming(true);
    try {
      await api.post('/coupons/vendor/redeem', { code });
      setDone('Redeemed — apply the offer! ✅'); setResult(null); setCode('');
    } catch (e: any) { setDone(e.message || 'Failed'); }
    setRedeeming(false);
  };

  return (
    <Card className="max-w-lg">
      <p className="font-bold text-sm mb-1">Verify a customer&apos;s coupon</p>
      <p className="text-[12.5px] text-gray-400 mb-4">Type the code from their QR / screen. Redeeming marks it used (one-time).</p>
      <div className="flex gap-2">
        <input className={`${inputCls} font-mono font-bold tracking-wider uppercase`} value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="DD-XXXX-XXXX"
          onKeyDown={(e) => e.key === 'Enter' && check()} />
        <button onClick={check} disabled={loading || code.length < 6}
          className="px-5 rounded-lg bg-primary text-white font-bold text-sm disabled:opacity-50">
          {loading ? '…' : 'Check'}
        </button>
      </div>
      {result && (
        <div className={`mt-4 rounded-xl p-4 ${result.valid ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
          {result.valid ? (
            <>
              <p className="flex items-center gap-2 font-extrabold text-emerald-700"><Check size={17} /> Valid coupon</p>
              <p className="text-[13px] text-gray-600 mt-2">
                <b>{result.claim?.campaign?.offerText}</b> — {result.claim?.campaign?.title}<br />
                Customer: {result.claim?.customer?.name} {result.claim?.customer?.phone && `(${result.claim.customer.phone})`}
              </p>
              <button onClick={redeem} disabled={redeeming}
                className="mt-3 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-extrabold text-sm disabled:opacity-50">
                {redeeming ? 'Redeeming…' : 'Redeem now (mark used)'}
              </button>
            </>
          ) : (
            <p className="flex items-center gap-2 font-extrabold text-red-600">
              <X size={17} /> {result.error || `Not valid — status: ${result.status || 'unknown'}`}
            </p>
          )}
        </div>
      )}
      {done && <p className="mt-4 font-bold text-emerald-600 text-sm">{done}</p>}
    </Card>
  );
}

/* ── API key ── */
function ApiKey({ vendor, onRotated }: { vendor: any; onRotated: () => void }) {
  const [freshKey, setFreshKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const rotate = async () => {
    setLoading(true);
    try { const r = await api.post('/coupons/vendor/api-key'); setFreshKey(r.apiKey); onRotated(); }
    catch {}
    setLoading(false);
  };
  const copy = () => { navigator.clipboard.writeText(freshKey); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <Card className="max-w-2xl">
      <p className="font-bold text-sm mb-1">Verification API key</p>
      <p className="text-[12.5px] text-gray-400 mb-4">
        Call <code className="bg-gray-100 px-1 rounded">POST /api/coupons/api/verify</code> and <code className="bg-gray-100 px-1 rounded">/redeem</code> from
        your own website&apos;s backend with header <code className="bg-gray-100 px-1 rounded">x-api-key</code>.
      </p>
      {freshKey ? (
        <div className="bg-ink text-emerald-300 rounded-xl p-4 font-mono text-[13px] flex items-center gap-3">
          <span className="truncate flex-1">{freshKey}</span>
          <button onClick={copy} className="text-white/70 hover:text-white">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
        </div>
      ) : (
        <p className="text-sm text-gray-500">{vendor.apiKey ? 'A key exists (hidden). Rotate to get a new one — the old key stops working.' : 'No key yet — generate one below.'}</p>
      )}
      <button onClick={rotate} disabled={loading}
        className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-50">
        <RefreshCw size={15} /> {vendor.apiKey || freshKey ? 'Rotate key' : 'Generate key'}
      </button>
      {freshKey && <p className="text-[11px] text-amber-600 mt-2">Copy it now — it won&apos;t be shown again.</p>}
    </Card>
  );
}

/* ── Packs ── */
function Packs({ onOrdered }: { onOrdered: () => void }) {
  const [data, setData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [msg, setMsg] = useState('');
  const load = () => {
    api.get('/coupons/vendor/packs').then(setData).catch(() => {});
    api.get('/coupons/vendor/pack-orders').then((r) => setOrders(r.items || [])).catch(() => {});
  };
  useEffect(load, []);

  const buy = async (categoryId: string, claims: number) => {
    setMsg('');
    try {
      const r = await api.post('/coupons/vendor/packs', { categoryId, claims });
      setMsg(r.message); load(); onOrdered();
    } catch (e: any) { setMsg(e.message || 'Failed'); }
  };

  const cur = CURRENCY_SYMBOL;
  return (
    <div className="space-y-4">
      {msg && <p className="text-sm font-semibold text-primary bg-primary-light rounded-xl px-4 py-3">{msg}</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {(data?.categories || []).map((c: any) => (
          <Card key={c._id}>
            <p className="font-extrabold text-[15px] mb-3">{c.icon} {c.name}</p>
            <div className="space-y-2">
              {c.packs.map((p: any) => (
                <div key={p.claims} className="flex items-center justify-between bg-band rounded-xl px-4 py-2.5">
                  <span className="text-sm font-bold">{p.claims.toLocaleString()} coupons {p.label && <span className="text-gray-400 font-semibold">· {p.label}</span>}</span>
                  <button onClick={() => buy(c._id, p.claims)}
                    className="text-[13px] font-extrabold text-primary hover:bg-primary hover:text-white border border-primary/30 rounded-full px-4 py-1.5 transition">
                    {cur}{(data.currency === 'USD' ? p.priceUSD : p.priceINR).toLocaleString()} · Buy
                  </button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {orders.length > 0 && (
        <Card>
          <p className="font-bold text-sm mb-3">My pack orders</p>
          <div className="space-y-2 text-[13px]">
            {orders.map((o) => (
              <div key={o._id} className="flex items-center gap-3 border-b border-gray-50 pb-2 last:border-0">
                <span className="font-bold">{o.claims} coupons</span>
                <span className="text-gray-400 flex-1">{o.category?.name} · {o.currency === 'USD' ? '$' : '₹'}{o.price}</span>
                <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${o.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : o.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{o.status}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
