'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Address } from '@/lib/types';
import { MapPin, Plus, Trash2, Edit2, Check } from 'lucide-react';

export default function AddressesPage() {
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAddresses = () => {
    api.get('/user/addresses')
      .then(res => setAddresses(res.addresses || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/addresses'); return; }
    fetchAddresses();
  }, [authLoading, isLoggedIn, router]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this address?')) return;
    await api.delete(`/user/addresses/${id}`);
    setAddresses(prev => prev.filter(a => a._id !== id));
  };

  const handleSetDefault = async (id: string) => {
    await api.put(`/user/addresses/${id}/default`, {});
    setAddresses(prev => prev.map(a => ({ ...a, isDefault: a._id === id })));
  };

  if (loading) return (
    <div className="px-4 py-4 space-y-3 animate-pulse">
      {[...Array(2)].map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
    </div>
  );

  return (
    <div className="px-4 py-4 md:px-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">My Addresses</h1>
        <button
          onClick={() => router.push('/address/new')}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark"
        >
          <Plus size={16} /> Add New
        </button>
      </div>

      {addresses.length === 0 ? (
        <div className="text-center py-14">
          <MapPin size={48} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400">No saved addresses</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map(addr => (
            <div key={addr._id} className={`bg-white rounded-2xl p-4 shadow-sm border-2 ${addr.isDefault ? 'border-primary' : 'border-transparent'}`}>
              <div className="flex items-start justify-between mb-1">
                <span className="text-xs font-bold text-primary uppercase">{addr.label}</span>
                {addr.isDefault && (
                  <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">DEFAULT</span>
                )}
              </div>
              <p className="text-sm text-gray-700">{addr.houseNo ? `${addr.houseNo}, ` : ''}{addr.address}</p>
              <p className="text-xs text-gray-400 mt-0.5">{addr.city}, {addr.state} {addr.pincode || addr.zip || ''}</p>

              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                {!addr.isDefault && (
                  <button onClick={() => handleSetDefault(addr._id)} className="flex items-center gap-1 text-xs text-primary font-semibold hover:text-primary-dark">
                    <Check size={14} /> Set Default
                  </button>
                )}
                <button onClick={() => router.push(`/address/${addr._id}`)} className="flex items-center gap-1 text-xs text-gray-500 font-semibold hover:text-gray-700 ml-auto">
                  <Edit2 size={13} /> Edit
                </button>
                <button onClick={() => handleDelete(addr._id)} className="flex items-center gap-1 text-xs text-red-500 font-semibold hover:text-red-600">
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
