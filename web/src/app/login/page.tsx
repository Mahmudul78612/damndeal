'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ChevronLeft } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[80vh] flex items-center justify-center"><div className="skeleton w-80 h-96 rounded-2xl" /></div>}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, verifyOtp } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/';

  const handleSendOtp = async () => {
    if (phone.length !== 10) { setError('Enter valid 10-digit phone number'); return; }
    setLoading(true);
    setError('');
    try {
      await login('+91' + phone);
      setStep('otp');
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (otp.length < 4) { setError('Enter valid OTP'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await verifyOtp('+91' + phone, otp);
      if (!res.isProfileComplete) {
        router.push('/complete-profile');
      } else {
        router.push(redirect);
      }
    } catch (e: any) {
      setError(e.message || 'Invalid OTP');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-extrabold text-2xl">DD</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900">DamnDeal</h1>
          <p className="text-gray-400 text-sm mt-1">Best deals, delivered to you</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          {step === 'phone' ? (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Login / Sign Up</h2>
              <p className="text-sm text-gray-400 mb-5">Enter your phone number to continue</p>

              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-3 border border-gray-200 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary">
                <span className="text-sm font-medium text-gray-500">+91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter phone number"
                  className="flex-1 bg-transparent text-sm outline-none"
                  maxLength={10}
                  autoFocus
                />
              </div>

              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

              <button
                onClick={handleSendOtp}
                disabled={loading || phone.length !== 10}
                className="w-full mt-4 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark transition disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => { setStep('phone'); setOtp(''); setError(''); }} className="flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700">
                <ChevronLeft size={16} /> Change number
              </button>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Verify OTP</h2>
              <p className="text-sm text-gray-400 mb-5">Enter the OTP sent to +91{phone}</p>

              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter OTP"
                className="w-full bg-gray-50 rounded-xl px-4 py-3 border border-gray-200 text-sm text-center tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                maxLength={6}
                autoFocus
              />

              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

              <button
                onClick={handleVerify}
                disabled={loading || otp.length < 4}
                className="w-full mt-4 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark transition disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>

              <button onClick={handleSendOtp} className="w-full mt-3 text-sm text-primary font-medium hover:underline">
                Resend OTP
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
