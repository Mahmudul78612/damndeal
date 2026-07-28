'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ChevronLeft } from 'lucide-react';

function getRegion(): 'IN' | 'US' {
  if (typeof window === 'undefined') return 'IN';
  const env = process.env.NEXT_PUBLIC_REGION;
  if (env) return env.toUpperCase() === 'US' ? 'US' : 'IN';
  const h = window.location.hostname;
  if (h === 'damndeal.com' || h.endsWith('.damndeal.com')) return 'US';
  return 'IN';
}

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
  const [region, setRegion] = useState<'IN' | 'US'>('IN');
  const { login, verifyOtp, firebaseVerify } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/';

  // Firebase refs — only used for US region
  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<any>(null);
  const confirmationResultRef = useRef<any>(null);

  useEffect(() => {
    setRegion(getRegion());
  }, []);

  const clearFirebase = () => {
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear(); } catch {}
      recaptchaVerifierRef.current = null;
    }
    confirmationResultRef.current = null;
  };

  const handleSendOtp = async () => {
    setLoading(true);
    setError('');

    try {
      if (region === 'US') {
        const digits = phone.replace(/\D/g, '');
        if (digits.length !== 10) { setError('Enter a valid 10-digit US phone number'); setLoading(false); return; }

        const { getFirebase } = await import('@/lib/firebase');
        const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
        const { auth } = getFirebase();

        clearFirebase();

        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current!, {
          size: 'invisible',
          callback: () => {},
        });

        confirmationResultRef.current = await signInWithPhoneNumber(auth, '+1' + digits, recaptchaVerifierRef.current);
      } else {
        if (phone.length !== 10) { setError('Enter a valid 10-digit phone number'); setLoading(false); return; }
        await login('+91' + phone);
      }

      setStep('otp');
    } catch (e: any) {
      setError(e.message || 'Failed to send OTP');
      clearFirebase();
    }

    setLoading(false);
  };

  const handleVerify = async () => {
    if (otp.length < 4) { setError('Enter a valid OTP'); return; }
    setLoading(true);
    setError('');

    try {
      let res;
      if (region === 'US') {
        if (!confirmationResultRef.current) throw new Error('Session expired. Please resend OTP.');
        const cred = await confirmationResultRef.current.confirm(otp);
        const idToken = await cred.user.getIdToken();
        res = await firebaseVerify(idToken);
      } else {
        res = await verifyOtp('+91' + phone, otp);
      }

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

  const countryCode = region === 'US' ? '+1' : '+91';
  const isPhoneValid = phone.replace(/\D/g, '').length === 10;

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
                <span className="text-sm font-medium text-gray-500">{countryCode}</span>
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

              {/* invisible reCAPTCHA mount point */}
              <div ref={recaptchaContainerRef} />

              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

              <button
                onClick={handleSendOtp}
                disabled={loading || !isPhoneValid}
                className="w-full mt-4 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark transition disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep('phone'); setOtp(''); setError(''); clearFirebase(); }}
                className="flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700"
              >
                <ChevronLeft size={16} /> Change number
              </button>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Verify OTP</h2>
              <p className="text-sm text-gray-400 mb-5">
                Enter the OTP sent to {countryCode}{phone}
              </p>

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
