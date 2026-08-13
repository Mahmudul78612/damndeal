'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useState } from 'react';
import { biz } from '@/lib/bizApi';
import { useBusiness } from '@/context/BusinessContext';
import { Users2, Copy, Check, Trash2, Mail } from 'lucide-react';

export default function TeamPage() {
  const { outlets, refresh } = useBusiness();
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({ name: '', email: '', phone: '', role: 'cashier', outlets: [] as string[] });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    try {
      const r = await biz.get('/coupons/business/members');
      setMembers(r.members || []);
      setRoles(r.roles || []);
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    if (!form.name.trim()) { setMsg({ ok: false, text: 'Enter a name' }); return; }
    if (!form.email.trim() && !form.phone.trim()) { setMsg({ ok: false, text: 'Enter an email or a phone number' }); return; }
    if (form.role === 'cashier' && !form.outlets.length) { setMsg({ ok: false, text: 'A cashier must be assigned to an outlet' }); return; }
    try {
      const r = await biz.post('/coupons/business/members', form);
      setInviteLink(r.inviteLink || '');
      setMsg({ ok: true, text: `${form.name} has been invited.` });
      setForm({ name: '', email: '', phone: '', role: 'cashier', outlets: [] });
      setOpen(false);
      load(); refresh();
    } catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  const setStatus = async (id: string, status: string) => {
    try { await biz.put(`/coupons/business/members/${id}`, { status }); load(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the team? They lose access immediately.`)) return;
    try { await biz.del(`/coupons/business/members/${id}`); load(); }
    catch (e) { setMsg({ ok: false, text: (e as Error).message }); }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    });
  };

  const outletNames = (ids: string[] = []) =>
    ids.map((id) => outlets.find((o: any) => String(o._id) === String(id))?.name).filter(Boolean).join(', ');

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Users2 size={18} className="text-primary" />
          <h1 className="text-[19px] font-extrabold text-ink">Team</h1>
        </div>
        <button onClick={() => { setOpen(true); setInviteLink(''); }} className="btn-claim px-4 py-2 text-[13px]">
          <span className="relative z-10">+ Invite</span>
        </button>
      </div>

      <p className="text-[12.5px] text-gray-500 mb-4">
        Everyone signs in with their own email and password. A cashier only sees the counter, and only for the outlets you assign.
      </p>

      {msg && (
        <div className={`rounded-xl px-4 py-3 mb-3 text-[13px] ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
          {msg.text}
        </div>
      )}

      {inviteLink && (
        <div className="bg-white border border-primary/30 rounded-xl p-3.5 mb-4">
          <p className="text-[12px] font-bold text-gray-500 mb-2">Invitation link — share it if the email does not arrive</p>
          <div className="flex items-center gap-2">
            <input readOnly value={inviteLink}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[12px] font-mono outline-none" />
            <button onClick={copyLink} className="px-3 py-2 rounded-lg bg-primary text-white text-[12.5px] font-bold flex items-center gap-1.5">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-6 text-center text-sm text-gray-400">Loading team…</p>
        ) : members.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-400">No team members yet — invite your first one.</p>
        ) : (
          members.map((m) => (
            <div key={m._id} className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0">
              <span className="w-9 h-9 rounded-full brand-grad grid place-items-center text-white text-[13px] font-extrabold shrink-0">
                {(m.name || '?').charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-[14px] text-ink truncate">{m.name}</p>
                <p className="text-[11.5px] text-gray-400 truncate">
                  {m.email || m.phone}
                  {m.scope?.outlets?.length ? ` · ${outletNames(m.scope.outlets)}` : ''}
                </p>
              </div>
              <span className="text-[10.5px] font-extrabold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary-light text-primary shrink-0">
                {m.role}
              </span>
              <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                m.status === 'active' ? 'bg-emerald-50 text-emerald-600'
                : m.status === 'invited' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'}`}>
                {m.status === 'invited' ? <span className="inline-flex items-center gap-1"><Mail size={10} /> invited</span> : m.status}
              </span>
              {m.role !== 'owner' && (
                <div className="flex items-center gap-1 shrink-0">
                  {m.status !== 'invited' && (
                    <button onClick={() => setStatus(m._id, m.status === 'active' ? 'disabled' : 'active')}
                      className="text-[11.5px] font-bold text-gray-400 hover:text-primary px-2">
                      {m.status === 'active' ? 'Disable' : 'Enable'}
                    </button>
                  )}
                  <button onClick={() => remove(m._id, m.name)} className="p-1.5 text-gray-300 hover:text-red-500">
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md p-5 max-h-[90vh] overflow-auto">
            <h3 className="font-extrabold text-[17px] text-ink mb-4">Invite a team member</h3>

            <Field label="Name *"><input className={inp} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Their full name" /></Field>
            <Field label="Email"><input className={inp} value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="them@business.com" /></Field>
            <Field label="Phone"><input className={inp} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Optional" /></Field>

            <Field label="Role">
              <select className={inp} value={form.role} onChange={(e) => set('role', e.target.value)}>
                {roles.filter((r) => r.key !== 'owner').map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </Field>

            <Field label={form.role === 'cashier' ? 'Outlets * (a cashier is locked to these)' : 'Outlets (leave empty for all)'}>
              <div className="border border-gray-200 rounded-lg p-2 max-h-40 overflow-auto">
                {outlets.length === 0 && <p className="text-[12px] text-gray-400 p-2">Add an outlet first.</p>}
                {outlets.map((o: any) => (
                  <label key={o._id} className="flex items-center gap-2 py-1.5 text-[13px] cursor-pointer">
                    <input type="checkbox" checked={form.outlets.includes(String(o._id))}
                      onChange={(e) => set('outlets', e.target.checked
                        ? [...form.outlets, String(o._id)]
                        : form.outlets.filter((x) => x !== String(o._id)))} />
                    <span>{o.name}{o.city ? <span className="text-gray-400"> — {o.city}</span> : null}</span>
                  </label>
                ))}
              </div>
            </Field>

            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 font-bold text-[13.5px] text-gray-500">Cancel</button>
              <button onClick={invite} className="btn-claim flex-1 py-2.5 text-[13.5px]"><span className="relative z-10">Send invite</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp = 'w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-[12px] font-bold text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
