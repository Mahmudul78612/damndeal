'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { useBrandLogo, useBrandName } from '@/context/ConfigContext';
import { X, ChevronLeft, ShoppingBag, Package, Heart } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirect?: string;
}

function getRegion(): 'IN' | 'US' {
  if (typeof window === 'undefined') return 'IN';
  const env = process.env.NEXT_PUBLIC_REGION;
  if (env) return env.toUpperCase() === 'US' ? 'US' : 'IN';
  const h = window.location.hostname;
  if (h === 'damndeal.com' || h.endsWith('.damndeal.com')) return 'US';
  return 'IN';
}

export default function LoginModal({ isOpen, onClose, redirect }: LoginModalProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [region, setRegion] = useState<'IN' | 'US'>('IN');
  const { login, verifyOtp, firebaseVerify } = useAuth();
  const brandLogo = useBrandLogo('light');
  const brandName = useBrandName();
  const router = useRouter();

  const recaptchaContainerRef = useRef<HTMLDivElement>(null);
  const recaptchaVerifierRef = useRef<any>(null);
  const confirmationResultRef = useRef<any>(null);

  useEffect(() => {
    setRegion(getRegion());
  }, []);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setPhone('');
      setOtp('');
      setStep('phone');
      setError('');
      clearFirebase();
    }
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

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

      onClose();
      if (!res.isProfileComplete) {
        router.push('/complete-profile');
      } else if (redirect) {
        router.push(redirect);
      }
    } catch (e: any) {
      setError(e.message || 'Invalid OTP');
    }

    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (step === 'phone') handleSendOtp();
      else handleVerify();
    }
  };

  const countryCode = region === 'US' ? '+1' : '+91';
  const isPhoneValid = phone.replace(/\D/g, '').length === 10;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-2xl w-[90vw] max-w-[720px] overflow-hidden flex md:min-h-[420px]">
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3 z-10 p-1 text-gray-400 hover:text-gray-600 bg-white/80 rounded-full">
          <X size={18} />
        </button>

        {/* Left panel (desktop) */}
        <div className="hidden md:flex flex-col justify-between w-[260px] bg-primary p-6 shrink-0">
          <div>
            <div className="bg-white rounded-lg p-2 inline-block mb-4 shadow-sm">
              <Image src={brandLogo} alt={brandName} width={120} height={40} className="h-9 w-auto object-contain" priority unoptimized />
            </div>
            <h2 className="text-xl font-extrabold text-white mb-2">Login</h2>
            <p className="text-sm text-white/80 leading-relaxed">
              Get access to your Orders, Wishlist and Recommendations
            </p>
          </div>
          <div className="flex items-end gap-3 mt-8">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <ShoppingBag size={20} className="text-white" />
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Package size={20} className="text-white" />
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Heart size={20} className="text-white" />
            </div>
          </div>
        </div>

        {/* Right panel (form) */}
        <div className="flex-1 p-5 md:p-8 flex flex-col justify-center">
          {/* Mobile logo */}
          <div className="md:hidden text-center mb-5">
            <Image src={brandLogo} alt={brandName} width={140} height={48} className="h-10 w-auto object-contain mx-auto" priority unoptimized />
          </div>

          {step === 'phone' ? (
            <div onKeyDown={handleKeyDown}>
              <h3 className="text-base font-bold text-gray-900 mb-0.5 hidden md:block">Login / Sign Up</h3>
              <p className="text-xs text-gray-400 mb-5">Enter your phone number to continue</p>

              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-200 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary">
                <span className="text-xs font-medium text-gray-500">{countryCode}</span>
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

              <p className="text-[10px] text-gray-400 mt-2">
                By continuing, you agree to DamnDeal&apos;s <span className="text-primary">Terms of Use</span> and <span className="text-primary">Privacy Policy</span>.
              </p>

              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

              <button
                onClick={handleSendOtp}
                disabled={loading || !isPhoneValid}
                className="w-full mt-4 py-2.5 bg-accent text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Request OTP'}
              </button>
            </div>
          ) : (
            <div onKeyDown={handleKeyDown}>
              <button
                onClick={() => { setStep('phone'); setOtp(''); setError(''); clearFirebase(); }}
                className="flex items-center gap-1 text-xs text-gray-500 mb-3 hover:text-gray-700"
              >
                <ChevronLeft size={14} /> Change number
              </button>
              <h3 className="text-base font-bold text-gray-900 mb-0.5">Verify OTP</h3>
              <p className="text-xs text-gray-400 mb-5">Enter the OTP sent to {countryCode}{phone}</p>

              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter OTP"
                className="w-full bg-gray-50 rounded-lg px-4 py-2.5 border border-gray-200 text-sm text-center tracking-[0.5em] font-bold focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                maxLength={6}
                autoFocus
              />

              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

              <button
                onClick={handleVerify}
                disabled={loading || otp.length < 4}
                className="w-full mt-4 py-2.5 bg-accent text-white rounded-lg font-bold text-sm hover:bg-amber-600 transition disabled:opacity-50"
              >
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
