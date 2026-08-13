'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { biz } from '@/lib/bizApi';
import { useBusiness } from '@/context/BusinessContext';
import { Store, Trash2, Upload, MapPin, Pencil } from 'lucide-react';

const BLANK = { name: '', code: '', address: '', state: '', city: '', pincode: '', phone: '', hours: '', lat: '', lng: '' };

export default function OutletsPage() {
  const { refresh } = useBusiness();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(BLANK);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [csv, setCsv] = useState('');

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    try {
      const r = await biz.get('/coupons/vendor/outlets');
      setItems(r.items || []);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setForm(BLANK); setOpen(true); };
  const openEdit = (o: any) => {
    setEditId(o._id);
    setForm({
      name: o.name || '', code: o.code || '', address: o.address || '', state: o.state || '',
      city: o.city || '', pincode: o.pincode || '', phone: o.phone || '', hours: o.hours || '',
      lat: o.point?.coordinates?.[1] ?? '', lng: o.point?.coordinates?.[0] ?? '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setMsg({ ok: false, text: 'Outlet name is required' }); return; }
    try {
      if (editId) await biz.put(`/coupons/vendor/outlets/${editId}`, form);
      else await biz.post('/coupons/vendor/outlets', form);
      setOpen(false);
      setMsg({ ok: true, text: editId ? 'Outlet updated' : 'Outlet added' });
      load(); refresh();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  const remove = async (o: any) => {
    if (!confirm(`Remove "${o.name}"? Coupons targeting only this outlet will stop showing near it.`)) return;
    try { await biz.del(`/coupons/vendor/outlets/${o._id}`); load(); refresh(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) { setMsg({ ok: false, text: 'Your browser cannot share a location' }); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => { set('lat', p.coords.latitude.toFixed(6)); set('lng', p.coords.longitude.toFixed(6)); },
      () => setMsg({ ok: false, text: 'Could not read your location' })
    );
  };

  /** Parse a pasted CSV in the browser and post plain rows. */
  const importCsv = async () => {
    const lines = csv.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) { setMsg({ ok: false, text: 'Paste a header row and at least one outlet' }); return; }
    const head = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(',');
      const row: any = {};
      head.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
      return row;
    });
    try {
      const r = await biz.post('/coupons/vendor/outlets/bulk', { rows });
      setMsg({ ok: true, text: `Imported ${r.imported} outlet(s)${r.skipped ? `, skipped ${r.skipped}` : ''}` });
      setBulkOpen(false); setCsv('');
      load(); refresh();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Store size={18} className="text-primary" />
          <h1 className="text-[19px] font-extrabold text-ink">Outlets</h1>
          <span className="text-[12px] text-gray-400">({items.length})</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setBulkOpen(true)}
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white font-bold text-[12.5px] text-gray-600 flex items-center gap-1.5">
            <Upload size={14} /> Import
          </button>
          <button onClick={openNew} className="btn-claim px-4 py-2 text-[13px]"><span className="relative z-10">+ Outlet</span></button>
        </div>
      </div>

      <p className="text-[12.5px] text-gray-500 mb-4">
        These are the shops where your coupons can be used. Add the location and customers nearby will see your offers — you never have to type a radius.
      </p>

      {msg && (
        <div className={`rounded-xl px-4 py-3 mb-3 text-[13px] ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {loading && <p className="text-sm text-gray-400 p-4">Loading outlets…</p>}
        {!loading && items.length === 0 && (
          <div className="sm:col-span-2 bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
            <p className="text-3xl mb-2">🏪</p>
            <p className="font-bold text-ink">No outlets yet</p>
            <p className="text-[13px] text-gray-500 mt-1">Add your first shop so nearby customers can find your coupons.</p>
          </div>
        )}
        {items.map((o) => (
          <div key={o._id} className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-[14.5px] text-ink truncate">{o.name}</p>
                <p className="text-[12px] text-gray-500 truncate">
                  {[o.address, o.city, o.state].filter(Boolean).join(', ') || 'No address yet'}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {o.point?.coordinates
                    ? <Tag tone="good">location set</Tag>
                    : <Tag tone="warn">no location — add it so nearby users see you</Tag>}
                  {o.code ? <Tag>{o.code}</Tag> : null}
                  {o.isActive === false ? <Tag tone="warn">inactive</Tag> : null}
                </div>
              </div>
              <button onClick={() => openEdit(o)} className="p-1.5 text-gray-300 hover:text-primary"><Pencil size={15} /></button>
              <button onClick={() => remove(o)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Modal onClose={() => setOpen(false)} title={editId ? 'Edit outlet' : 'Add an outlet'}>
          <Field label="Outlet name *"><input className={inp} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Sector 17 branch" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Your store code"><input className={inp} value={form.code} onChange={(e) => set('code', e.target.value)} placeholder="Optional" /></Field>
            <Field label="Phone"><input className={inp} value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          </div>
          <Field label="Address"><input className={inp} value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="City"><input className={inp} value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
            <Field label="State"><input className={inp} value={form.state} onChange={(e) => set('state', e.target.value)} /></Field>
            <Field label="Pincode"><input className={inp} value={form.pincode} onChange={(e) => set('pincode', e.target.value)} /></Field>
          </div>
          <Field label="Opening hours"><input className={inp} value={form.hours} onChange={(e) => set('hours', e.target.value)} placeholder="10am – 9pm" /></Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Latitude"><input className={inp} value={form.lat} onChange={(e) => set('lat', e.target.value)} /></Field>
            <Field label="Longitude"><input className={inp} value={form.lng} onChange={(e) => set('lng', e.target.value)} /></Field>
          </div>
          <button onClick={useMyLocation}
            className="w-full mb-1 py-2 rounded-lg border border-gray-200 text-[12.5px] font-bold text-gray-600 flex items-center justify-center gap-1.5">
            <MapPin size={14} /> Use my current location
          </button>

          <div className="flex gap-2 mt-4">
            <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-[13.5px] text-gray-500">Cancel</button>
            <button onClick={save} className="btn-claim flex-1 py-2.5 text-[13.5px]"><span className="relative z-10">{editId ? 'Save' : 'Add outlet'}</span></button>
          </div>
        </Modal>
      )}

      {bulkOpen && (
        <Modal onClose={() => setBulkOpen(false)} title="Import outlets from CSV">
          <p className="text-[12.5px] text-gray-500 mb-2">
            Paste your spreadsheet with a header row. Recognised columns:
          </p>
          <code className="block bg-gray-50 border border-gray-200 rounded-lg p-2 text-[11.5px] mb-3 overflow-x-auto">
            name,code,address,city,state,pincode,phone,hours,lat,lng
          </code>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={9}
            placeholder={'name,city,state,lat,lng\nSector 17,Chandigarh,Punjab,30.7415,76.7681'}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[12.5px] font-mono outline-none focus:border-primary" />
          <div className="flex gap-2 mt-4">
            <button onClick={() => setBulkOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-[13.5px] text-gray-500">Cancel</button>
            <button onClick={importCsv} className="btn-claim flex-1 py-2.5 text-[13.5px]"><span className="relative z-10">Import</span></button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const inp = 'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="mb-3"><label className="block text-[12px] font-bold text-gray-500 mb-1.5">{label}</label>{children}</div>;
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: 'good' | 'warn' }) {
  const cls = tone === 'good' ? 'bg-emerald-50 text-emerald-600'
    : tone === 'warn' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500';
  return <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-auto">
        <h3 className="font-extrabold text-[17px] text-ink mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
