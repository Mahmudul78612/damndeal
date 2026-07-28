'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api, IS_US } from '@/lib/api';
import { ChevronLeft, Navigation } from 'lucide-react';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
];

export default function AddressFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();

  const [form, setForm] = useState({
    label: 'home',
    houseNo: '',      // Apt/Suite (US) or House No. (IN)
    address: '',      // Street address
    landmark: '',
    city: '',
    state: '',
    pincode: '',      // IN
    zip: '',          // US
    latitude: 0,
    longitude: 0,
  });
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/addresses'); return; }
    if (!isNew) {
      api.get(`/user/addresses/${id}`)
        .then(res => {
          const a = res.address;
          if (a) setForm({
            label: a.label || 'home',
            houseNo: a.houseNo || '',
            address: a.address || '',
            landmark: a.landmark || '',
            city: a.city || '',
            state: a.state || '',
            pincode: a.pincode || '',
            zip: a.zip || '',
            latitude: a.lat || 0,
            longitude: a.lng || 0,
          });
        })
        .catch(() => {});
    }
  }, [id, isNew, isLoggedIn, router]);

  const handleGeolocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setForm(f => ({ ...f, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Build a region-correct payload (US: street/apt/city/state/ZIP).
      const street = form.houseNo ? `${form.houseNo}, ${form.address}` : form.address;
      const payload: any = {
        label: form.label,
        address: street,
        landmark: form.landmark,
        city: form.city,
        state: form.state,
      };
      if (IS_US) {
        payload.zip = form.zip;
      } else {
        payload.pincode = form.pincode;
        payload.lat = form.latitude;
        payload.lng = form.longitude;
      }
      if (isNew) await api.post('/user/addresses', payload);
      else await api.put(`/user/addresses/${id}`, payload);
      router.push('/addresses');
    } catch (err: any) {
      alert(err.message || 'Failed to save address');
    }
    setLoading(false);
  };

  const set = (key: string, val: string) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="px-4 py-4 md:px-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">{isNew ? 'Add Address' : 'Edit Address'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Label pills */}
        <div>
          <label className="text-xs font-bold text-gray-500 mb-1 block">Address Type</label>
          <div className="flex gap-2">
            {['home', 'work', 'other'].map(l => (
              <button
                key={l}
                type="button"
                onClick={() => set('label', l)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${form.label === l ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}
              >
                {l.charAt(0).toUpperCase() + l.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {IS_US ? (
          /* ── US address format ── */
          <>
            <Input label="Street Address" value={form.address} onChange={v => set('address', v)} placeholder="123 Main St" required />
            <Input label="Apt / Suite / Unit (optional)" value={form.houseNo} onChange={v => set('houseNo', v)} placeholder="Apt 4B" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="City" value={form.city} onChange={v => set('city', v)} placeholder="City" required />
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">State</label>
                <select
                  value={form.state}
                  onChange={e => set('state', e.target.value)}
                  required
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select state</option>
                  {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <Input label="ZIP Code" value={form.zip} onChange={v => set('zip', v.replace(/[^0-9-]/g, ''))} placeholder="10001" required maxLength={10} pattern="\d{5}(-\d{4})?" />
          </>
        ) : (
          /* ── India address format ── */
          <>
            <button
              type="button"
              onClick={handleGeolocate}
              disabled={locating}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-primary/40 rounded-xl text-sm text-primary font-semibold hover:bg-primary/5"
            >
              <Navigation size={16} />
              {locating ? 'Getting location...' : 'Use Current Location'}
            </button>

            <Input label="Flat / House No." value={form.houseNo} onChange={v => set('houseNo', v)} placeholder="e.g. B-12, 3rd Floor" />
            <Input label="Street / Area / Landmark" value={form.address} onChange={v => set('address', v)} placeholder="Full address" required />
            <Input label="Landmark (optional)" value={form.landmark} onChange={v => set('landmark', v)} placeholder="Near..." />
            <div className="grid grid-cols-2 gap-3">
              <Input label="City" value={form.city} onChange={v => set('city', v)} placeholder="City" required />
              <Input label="State" value={form.state} onChange={v => set('state', v)} placeholder="State" required />
            </div>
            <Input label="Pincode" value={form.pincode} onChange={v => set('pincode', v)} placeholder="6-digit pincode" required maxLength={6} pattern="\d{6}" />
          </>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark disabled:opacity-50 transition mt-2"
        >
          {loading ? 'Saving...' : isNew ? 'Save Address' : 'Update Address'}
        </button>
      </form>
    </div>
  );
}

function Input({ label, value, onChange, ...props }: { label: string; value: string; onChange: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  return (
    <div>
      <label className="text-xs font-bold text-gray-500 mb-1 block">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        {...props}
      />
    </div>
  );
}
