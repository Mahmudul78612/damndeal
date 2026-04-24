'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function CompleteProfilePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { completeProfile } = useAuth();
  const router = useRouter();

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    setError('');
    try {
      await completeProfile(name.trim(), email.trim());
      router.push('/');
    } catch (e: any) {
      setError(e.message || 'Failed to update profile');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-extrabold text-gray-900">Complete Profile</h1>
          <p className="text-gray-400 text-sm mt-1">Just a few more details</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your full name"
              className="w-full bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">Email (optional)</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading || !name.trim()}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark transition disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
