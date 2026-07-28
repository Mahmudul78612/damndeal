'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useLoc } from '@/context/LocationContext';
import { api } from '@/lib/api';
import { statesFor } from '@/lib/states';
import { X, ChevronLeft, BadgePercent, QrCode } from 'lucide-react';

function getRegion(): 'IN' | 'US' {
  if (typeof window === 'undefined') return 'IN';
  const env = process.env.NEXT_PUBLIC_REGION;
  if (env) return env.toUpperCase() === 'US' ? 'US' : 'IN';
  const h = window.location.hostname;
  if (h === 'damndeal.com' || h.endsWith('.damndeal.com')) return 'US';
  return 'IN';
}

export default function LoginModal() {
  const { showLoginModal, closeLoginModal, loginRedirect, login, verifyOtp, firebaseVerify } = useAuth();
  const { loc, setLoc } = useLoc();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'profile'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [region, setRegion] = useState<'IN' | 'US'>('IN');
  const [pName, setPName] = useState('');
  const [pEmail, setPEmail] = useState('');
  const [pState, setPState] = useState('');
  const router = useRouter();

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recaptchaVerifierRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const confirmationResultRef = useRef<any>(null);

  useEffect(() => { setRegion(getRegion()); }, []);

  useEffect(() => {
    if (showLoginModal) { setPhone(''); setOtp(''); setStep('phone'); setError(''); clearFirebase(); }
  }, [showLoginModal]);

  useEffect(() => {
    document.body.style.overflow = showLoginModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showLoginModal]);

  if (!showLoginModal) return null;

  const clearFirebase = () => {
    if (recaptchaVerifierRef.current) {
      try { recaptchaVerifierRef.current.clear(); } catch {}
      recaptchaVerifierRef.current = null;
    }
    confirmationResultRef.current = null;
  };

  const handleSendOtp = async () => {
    setLoading(true); setError('');
    try {
      if (region === 'US') {
        const digits = phone.replace(/\D/g, '');
        if (digits.length !== 10) { setError('Enter a valid 10-digit US phone number'); setLoading(false); return; }
        const { getFirebase } = await import('@/lib/firebase');
        const { RecaptchaVerifier, signInWithPhoneNumber } = await import('firebase/auth');
        const { auth } = getFirebase();
        clearFirebase();
        recaptchaVerifierRef.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current!, { size: 'invisible', callback: () => {} });
        confirmationResultRef.current = await signInWithPhoneNumber(auth, '+1' + digits, recaptchaVerifierRef.current);
      } else {
        if (phone.length !== 10) { setError('Enter a valid 10-digit phone number'); setLoading(false); return; }
        await login('+91' + phone);
      }
      setStep('otp');
    } catch (e) {
      setError((e as Error).message || 'Failed to send OTP');
      clearFirebase();
    }
    setLoading(false);
  };

  const handleVerify = async () => {
    if (otp.length < 4) { setError('Enter a valid OTP'); return; }
    setLoading(true); setError('');
    try {
      let res: { isProfileComplete?: boolean };
      if (region === 'US') {
        if (!confirmationResultRef.current) throw new Error('Session expired. Please resend OTP.');
        const cred = await confirmationResultRef.current.confirm(otp);
        const idToken = await cred.user.getIdToken();
        res = await firebaseVerify(idToken);
      } else {
        res = await verifyOtp('+91' + phone, otp);
      }
      if (res.isProfileComplete === false) {
        // First sign-in — ask name, email and state
        setStep('profile');
      } else {
        closeLoginModal();
        if (loginRedirect) router.push(loginRedirect);
      }
    } catch (e) {
      setError((e as Error).message || 'Invalid OTP');
    }
    setLoading(false);
  };

  const handleProfile = async () => {
    if (!pName.trim()) { setError('Apna naam likho'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(pEmail)) { setError('Sahi email likho'); return; }
    setLoading(true); setError('');
    try {
      await api.put('/auth/complete-profile', { name: pName.trim(), email: pEmail.trim() });
      if (pState) setLoc({ ...loc, state: pState, lat: null, lng: null });
      closeLoginModal();
      if (loginRedirect) router.push(loginRedirect);
    } catch (e) {
      setError((e as Error).message || 'Failed to save profile');
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { if (step === 'phone') handleSendOtp(); else handleVerify(); }
  };

  const countryCode = region === 'US' ? '+1' : '+91';
  const isPhoneValid = phone.replace(/\D/g, '').length === 10;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeLoginModal} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-[680px] overflow-hidden flex md:min-h-[400px]">
        <button onClick={closeLoginModal} className="absolute top-3 right-3 z-10 p-1 text-gray-400 hover:text-gray-600 bg-white/80 rounded-full">
          <X size={18} />
        </button>

        <div className="hidden md:flex flex-col justify-between w-[250px] bg-primary p-6 shrink-0">
          <div>
            <div className="bg-white rounded-xl p-2.5 inline-block mb-5 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="DamnDeal Coupons" className="h-10 w-auto" />
            </div>
            <h2 className="text-xl font-extrabold text-white mb-2">Sign in</h2>
            <p className="text-sm text-white/80 leading-relaxed">Claim coupons, keep your codes and QR in one place.</p>
          </div>
          <div className="flex items-end gap-3 mt-8">
            <div className="w-11 h-11 bg-white/20 rounded-lg grid place-items-center"><BadgePercent size={18} className="text-white" /></div>
            <div className="w-11 h-11 bg-white/20 rounded-lg grid place-items-center"><QrCode size={18} className="text-white" /></div>
          </div>
        </div>

        <div className="flex-1 p-5 md:p-8 flex flex-col justify-center">
          <div className="md:hidden flex justify-center mb-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="DamnDeal Coupons" className="h-11 w-auto" />
          </div>

          {step === 'profile' ? (
            <div onKeyDown={(e) => e.key === 'Enter' && handleProfile()}>
              <h3 className="text-base font-bold text-gray-900 mb-0.5">Welcome! 🎉 Apna profile banao</h3>
              <p className="text-xs text-gray-400 mb-5">Bas ek baar — naam, email aur apna state.</p>
              <input type="text" value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Full name" autoFocus
                className="w-full bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              <input type="email" value={pEmail} onChange={(e) => setPEmail(e.target.value)} placeholder="Email address"
                className="w-full mt-3 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary" />
              <select value={pState} onChange={(e) => setPState(e.target.value)}
                className="w-full mt-3 bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary">
                <option value="">Select your state (offers filter isse hote hain)</option>
                {statesFor(region).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              <button onClick={handleProfile} disabled={loading}
                className="w-full mt-4 py-2.5 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary-dark transition disabled:opacity-50">
                {loading ? 'Saving...' : 'Save & continue'}
              </button>
            </div>
          ) : step === 'phone' ? (
            <div onKeyDown={handleKeyDown}>
              <h3 className="text-base font-bold text-gray-900 mb-0.5 hidden md:block">Login / Sign Up</h3>
              <p className="text-xs text-gray-400 mb-5">Enter your phone number to continue</p>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary">
                <span className="text-xs font-medium text-gray-500">{countryCode}</span>
                <input type="tel" value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="Enter phone number"
                  className="flex-1 bg-transparent text-sm outline-none" maxLength={10} autoFocus />
              </div>
              <div ref={recaptchaContainerRef} />
              <p className="text-[10px] text-gray-400 mt-2">
                By continuing, you agree to DamnDeal&apos;s Terms of Use and Privacy Policy.
              </p>
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              <button onClick={handleSendOtp} disabled={loading || !isPhoneValid}
                className="w-full mt-4 py-2.5 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary-dark transition disabled:opacity-50">
                {loading ? 'Sending...' : 'Request OTP'}
              </button>
            </div>
          ) : (
            <div onKeyDown={handleKeyDown}>
              <button onClick={() => { setStep('phone'); setOtp(''); setError(''); clearFirebase(); }}
                className="flex items-center gap-1 text-xs text-gray-500 mb-3 hover:text-gray-700">
                <ChevronLeft size={14} /> Change number
              </button>
              <h3 className="text-base font-bold text-gray-900 mb-0.5">Verify OTP</h3>
              <p className="text-xs text-gray-400 mb-5">Enter the OTP sent to {countryCode}{phone}</p>
              <input type="text" value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter OTP"
                className="w-full bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200 text-sm text-center tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                maxLength={6} autoFocus />
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
              <button onClick={handleVerify} disabled={loading || otp.length < 4}
                className="w-full mt-4 py-2.5 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary-dark transition disabled:opacity-50">
                {loading ? 'Verifying...' : 'Verify & Login'}
              </button>
              <button onClick={handleSendOtp} className="w-full mt-2 text-xs text-primary font-medium hover:underline">
                Resend OTP
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
