'use client';

/* eslint-disable @typescript-eslint/no-explicit-any, @next/next/no-img-element */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, imgUrl, CURRENCY_SYMBOL, IS_US } from '@/lib/api';
import { useDdgoCart } from '@/context/DdgoCartContext';
import { useAuth } from '@/context/AuthContext';
import { readLocation } from '@/lib/ddgoLocation';
import { Address } from '@/lib/types';
import {
  ArrowLeft, MapPin, Plus, Clock, Store, LoaderCircle, CheckCircle2,
  Banknote, CreditCard, ShoppingBasket, AlertTriangle,
} from 'lucide-react';

/**
 * DDGo checkout — one store, one rider, minutes not days.
 *
 * Separate from the marketplace checkout because the two describe different
 * promises: this one re-verifies that the chosen store still covers the
 * delivery address (the server refuses otherwise), charges the store's own
 * shelf prices, and lands the customer on live order tracking.
 */

type Step = 'loading' | 'ready' | 'placing' | 'done';

export default function DdgoCheckoutPage() {
  const cart = useDdgoCart();
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('loading');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddr, setSelectedAddr] = useState('');
  const [partnerId, setPartnerId] = useState('');
  const [storeInfo, setStoreInfo] = useState<any>(null);
  const [estimate, setEstimate] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState(IS_US ? 'stripe' : 'cod');
  const [error, setError] = useState('');
  const [placedId, setPlacedId] = useState('');

  /* ── Boot: sign-in, addresses, and which account this store settles to ── */
  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/grocery/checkout'); return; }
    if (!cart.itemCount || !cart.storeId) { setStep('ready'); return; }

    const loc = readLocation();
    if (!loc) { router.replace('/grocery'); return; }

    (async () => {
      try {
        const [info, addrRes] = await Promise.all([
          api.get(`/user/ddgo/stores/${cart.storeId}/checkout-info?lat=${loc.lat}&lng=${loc.lng}`),
          api.get('/user/addresses'),
        ]);
        setPartnerId(info.partnerId);
        setStoreInfo(info.store);
        const addrs: Address[] = addrRes.addresses || [];
        setAddresses(addrs);
        const def = addrs.find((a) => a.isDefault) || addrs[0];
        if (def) setSelectedAddr(def._id);
        setStep('ready');
      } catch (e: any) {
        setError(e?.message || 'Could not start checkout.');
        setStep('ready');
      }
    })();
  }, [authLoading, isLoggedIn, cart.itemCount, cart.storeId, openLoginModal, router]);

  /* ── Fees for the chosen address ── */
  useEffect(() => {
    if (!partnerId || !selectedAddr || !cart.itemCount) return;
    const ids = cart.items.map((i) => i.productId).join(',');
    api.get(`/user/orders/delivery-estimate?partnerId=${partnerId}&addressId=${selectedAddr}&subtotal=${cart.subtotal}&platform=ddgo&productIds=${ids}&paymentMethod=${paymentMethod}`)
      .then((r) => setEstimate(r.estimate))
      .catch(() => setEstimate(null));
  }, [partnerId, selectedAddr, cart.subtotal, cart.itemCount, cart.items, paymentMethod]);

  /* ── Razorpay SDK (India online payments) ── */
  useEffect(() => {
    if (IS_US || typeof window === 'undefined' || (window as any).Razorpay) return;
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    document.body.appendChild(s);
  }, []);

  const place = useCallback(async () => {
    if (!selectedAddr) { setError('Choose a delivery address first.'); return; }
    setStep('placing');
    setError('');
    try {
      const orderRes = await api.post('/user/orders', {
        partnerId,
        platform: 'ddgo',
        items: cart.items.map((i) => ({ product: i.productId, quantity: i.quantity })),
        addressId: selectedAddr,
        paymentMethod,
      });
      const order = orderRes.order;

      if (paymentMethod === 'stripe') {
        const res = await api.post('/user/payments/stripe/checkout', { orderId: order._id });
        if (!res.url) throw new Error('Could not start payment. Please try again.');
        cart.clear();
        window.location.href = res.url;
        return;
      }

      if (paymentMethod === 'razorpay') {
        const rz = await api.post('/user/payments/create', { orderId: order._id });
        if (!(window as any).Razorpay) throw new Error('Payment gateway is still loading — try again.');
        await new Promise<void>((resolve, reject) => {
          const rzp = new (window as any).Razorpay({
            key: rz.key, amount: rz.amount, currency: rz.currency, order_id: rz.razorpayOrderId,
            name: 'DamnDeal Go', description: `Order ${order.orderNumber}`,
            theme: { color: '#0D7A30' },
            handler: async (resp: any) => {
              try {
                await api.post('/user/payments/verify', {
                  razorpayOrderId: resp.razorpay_order_id,
                  razorpayPaymentId: resp.razorpay_payment_id,
                  razorpaySignature: resp.razorpay_signature,
                });
                resolve();
              } catch (e: any) { reject(new Error(e.message || 'Payment verification failed')); }
            },
            modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
          });
          rzp.on('payment.failed', (resp: any) =>
            reject(new Error(resp?.error?.description || 'Payment failed')));
          rzp.open();
        });
      }

      cart.clear();
      setPlacedId(order._id);
      setStep('done');
      setTimeout(() => router.push(`/grocery/orders/${order._id}`), 1800);
    } catch (e: any) {
      setError(e?.message || 'Could not place the order.');
      setStep('ready');
    }
  }, [selectedAddr, partnerId, paymentMethod, cart, router]);

  /* ── Screens ── */
  if (authLoading || step === 'loading') {
    return <Center><LoaderCircle size={24} className="animate-spin text-[#0D7A30]" /></Center>;
  }

  if (step === 'done') {
    return (
      <Center>
        <div className="w-16 h-16 rounded-full bg-[#E3F6E9] grid place-items-center mx-auto mb-4">
          <CheckCircle2 size={32} className="text-[#0D7A30]" />
        </div>
        <p className="text-[18px] font-extrabold text-gray-900">Order placed!</p>
        <p className="text-[13px] text-gray-500 mt-1">Taking you to live tracking…</p>
        {placedId && (
          <Link href={`/grocery/orders/${placedId}`} prefetch className="inline-block mt-4 text-[13px] font-bold text-[#0D7A30] underline">
            Track now
          </Link>
        )}
      </Center>
    );
  }

  if (!cart.itemCount) {
    return (
      <Center>
        <ShoppingBasket size={30} className="mx-auto mb-3 text-gray-300" />
        <p className="font-bold text-gray-600">Your basket is empty</p>
        <Link href="/grocery" prefetch className="inline-block mt-5 px-6 py-2.5 bg-[#0D7A30] text-white rounded-xl font-bold text-sm">
          Browse stores
        </Link>
      </Center>
    );
  }

  const deliveryFee = estimate?.freeDeliveryApplied ? 0 : (estimate?.deliveryFee ?? null);
  const platformFee = estimate?.platformFee ?? 0;
  const codFee = paymentMethod === 'cod' ? (estimate?.codFee || 0) : 0;
  const total = cart.subtotal + (deliveryFee || 0) + platformFee + codFee;
  const minOrder = estimate?.minOrderAmount || storeInfo?.minOrderAmount || 0;
  const belowMin = minOrder > 0 && cart.subtotal < minOrder;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="max-w-[700px] mx-auto px-4 py-3 flex items-center gap-2">
          <Link href="/grocery/cart" prefetch className="p-1 -ml-1 text-gray-500 hover:text-gray-900">
            <ArrowLeft size={19} />
          </Link>
          <h1 className="text-[16px] font-extrabold text-gray-900">Checkout</h1>
        </div>
      </div>

      <div className="max-w-[700px] mx-auto px-4 py-4 pb-40 space-y-3">
        {/* Store */}
        {storeInfo && (
          <div className="bg-white rounded-2xl border border-gray-200 p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E3F6E9] grid place-items-center shrink-0">
              <Store size={18} className="text-[#0D7A30]" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-[14px] text-gray-900 truncate">{storeInfo.name}</p>
              <p className="text-[11.5px] text-gray-500 flex items-center gap-1">
                <Clock size={11} className="text-[#0D7A30]" /> Delivery in about {storeInfo.etaMins} minutes
              </p>
            </div>
          </div>
        )}

        {/* Address */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2.5">
            <p className="font-bold text-[13.5px] text-gray-900">Deliver to</p>
            <Link href="/addresses" prefetch className="text-[12px] font-bold text-[#0D7A30] flex items-center gap-0.5">
              <Plus size={13} /> Add address
            </Link>
          </div>
          {addresses.length === 0 ? (
            <p className="text-[12.5px] text-gray-400">
              No saved address yet — add one to continue.
            </p>
          ) : (
            <div className="space-y-2">
              {addresses.map((a) => (
                <button
                  key={a._id}
                  onClick={() => setSelectedAddr(a._id)}
                  className={`w-full text-left flex gap-2.5 rounded-xl border p-3 transition ${
                    selectedAddr === a._id ? 'border-[#0D7A30] bg-[#0D7A30]/5' : 'border-gray-200'
                  }`}
                >
                  <MapPin size={15} className={`shrink-0 mt-0.5 ${selectedAddr === a._id ? 'text-[#0D7A30]' : 'text-gray-400'}`} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-gray-900">{a.label}</span>
                    <span className="block text-[12px] text-gray-500 leading-snug">
                      {[a.houseNo, a.address, a.city, a.pincode || a.zip].filter(Boolean).join(', ')}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <p className="px-4 pt-3.5 pb-1.5 font-bold text-[13.5px] text-gray-900">
            {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'}
          </p>
          <div className="divide-y divide-gray-100">
            {cart.items.map((i) => (
              <div key={i.productId} className="px-4 py-2 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gray-50 overflow-hidden shrink-0 grid place-items-center">
                  {i.image
                    ? <img src={imgUrl(i.image)} alt={i.name} className="w-full h-full object-cover" />
                    : <ShoppingBasket size={13} className="text-gray-300" />}
                </div>
                <p className="flex-1 min-w-0 text-[12.5px] text-gray-800 truncate">
                  {i.name} <span className="text-gray-400">× {i.quantity}</span>
                </p>
                <p className="text-[12.5px] font-bold text-gray-900 shrink-0">
                  {CURRENCY_SYMBOL}{i.price * i.quantity}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <p className="font-bold text-[13.5px] text-gray-900 mb-2.5">Payment</p>
          <div className="space-y-2">
            {!IS_US && (
              <PayOption
                active={paymentMethod === 'cod'} onClick={() => setPaymentMethod('cod')}
                icon={<Banknote size={17} />} title="Cash on Delivery"
                sub={codFee > 0 ? `+ ${CURRENCY_SYMBOL}${codFee} COD fee` : 'Pay when it arrives'}
              />
            )}
            <PayOption
              active={paymentMethod === (IS_US ? 'stripe' : 'razorpay')}
              onClick={() => setPaymentMethod(IS_US ? 'stripe' : 'razorpay')}
              icon={<CreditCard size={17} />}
              title={IS_US ? 'Pay by card' : 'UPI / Card / Netbanking'}
              sub="Pay securely online"
            />
          </div>
        </div>

        {/* Bill */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-1">
          <Bill label={`Items (${cart.itemCount})`} v={cart.subtotal} />
          {deliveryFee !== null && <Bill label="Delivery" v={deliveryFee} freeWhenZero />}
          {platformFee > 0 && <Bill label="Platform fee" v={platformFee} />}
          {codFee > 0 && <Bill label="COD fee" v={codFee} />}
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-200">
            <span className="text-[14px] font-extrabold text-gray-900">To pay</span>
            <span className="text-[16px] font-extrabold text-gray-900">{CURRENCY_SYMBOL}{Math.round(total * 100) / 100}</span>
          </div>
        </div>

        {belowMin && (
          <p className="flex items-start gap-2 text-[12.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            This store has a minimum order of {CURRENCY_SYMBOL}{minOrder}. Add {CURRENCY_SYMBOL}{minOrder - cart.subtotal} more to place the order.
          </p>
        )}
        {error && (
          <p className="flex items-start gap-2 text-[12.5px] text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertTriangle size={15} className="shrink-0 mt-0.5" /> {error}
          </p>
        )}
      </div>

      {/* Place order */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-100 px-4 py-3">
        <div className="max-w-[700px] mx-auto">
          <button
            onClick={place}
            disabled={step === 'placing' || !selectedAddr || belowMin || !partnerId}
            className="w-full py-3.5 rounded-xl bg-[#0D7A30] text-white font-extrabold text-[15px] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {step === 'placing'
              ? <><LoaderCircle size={17} className="animate-spin" /> Placing your order…</>
              : `Place order · ${CURRENCY_SYMBOL}${Math.round(total * 100) / 100}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="max-w-md mx-auto text-center py-28 px-4">{children}</div>;
}

function PayOption({ active, onClick, icon, title, sub }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition ${
        active ? 'border-[#0D7A30] bg-[#0D7A30]/5' : 'border-gray-200'
      }`}
    >
      <span className={active ? 'text-[#0D7A30]' : 'text-gray-400'}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-bold text-gray-900">{title}</span>
        <span className="block text-[11.5px] text-gray-500">{sub}</span>
      </span>
      <span className={`w-4 h-4 rounded-full border-2 grid place-items-center ${active ? 'border-[#0D7A30]' : 'border-gray-300'}`}>
        {active && <span className="w-2 h-2 rounded-full bg-[#0D7A30]" />}
      </span>
    </button>
  );
}

function Bill({ label, v, freeWhenZero }: { label: string; v: number; freeWhenZero?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12.5px] text-gray-600">{label}</span>
      <span className={`text-[12.5px] font-semibold ${v === 0 && freeWhenZero ? 'text-[#0D7A30]' : 'text-gray-800'}`}>
        {v === 0 && freeWhenZero ? 'FREE' : `${CURRENCY_SYMBOL}${v}`}
      </span>
    </div>
  );
}
