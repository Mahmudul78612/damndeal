'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { ChevronLeft, MapPin, Navigation } from 'lucide-react';

export default function AddressFormPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();

  const [form, setForm] = useState({
    label: 'home',
    houseNo: '',
    address: '',
    landmark: '',
    city: '',
    state: '',
    pincode: '',
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
            latitude: a.latitude || 0,
            longitude: a.longitude || 0,
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
      if (isNew) {
        await api.post('/user/addresses', form);
      } else {
        await api.put(`/user/addresses/${id}`, form);
      }
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

        {/* Geolocation */}
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
