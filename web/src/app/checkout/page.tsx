'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { api, imgUrl, IS_US, CURRENCY_SYMBOL } from '@/lib/api';
import { Address } from '@/lib/types';
import { ChevronLeft, MapPin, Plus, Loader2, XCircle, ShieldCheck, Truck, Clock, Package } from 'lucide-react';

export default function CheckoutPage() {
  const { items, subtotal, totalGst, totalSavings, partnerId, clear } = useCart();
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const router = useRouter();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddr, setSelectedAddr] = useState<string>('');
  // US (damndeal.com) pays by card via Stripe; India uses COD/Razorpay (Wallet hidden for now).
  const cur = CURRENCY_SYMBOL;
  const [paymentMethod, setPaymentMethod] = useState(IS_US ? 'stripe' : 'cod');
  const [note, setNote] = useState('');
  const [estimate, setEstimate] = useState<any>(null);
  const [pincodeEst, setPincodeEst] = useState<any>(null);
  const [placing, setPlacing] = useState(false);
  const [placingText, setPlacingText] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/checkout'); return; }
    if (items.length === 0 && !orderSuccess) { router.push('/cart'); return; }
    api.get('/user/addresses')
      .then(res => {
        const addrs = res.addresses || [];
        setAddresses(addrs);
        const def = addrs.find((a: Address) => a.isDefault);
        if (def) setSelectedAddr(def._id);
        else if (addrs.length) setSelectedAddr(addrs[0]._id);
      });
  }, [isLoggedIn, items.length, router]);

  // Delivery estimate from partner (re-fetch when payment method changes for COD fee)
  useEffect(() => {
    if (!selectedAddr || !partnerId) return;
    const productIds = items.map(i => i.productId.split('_')[0]).join(',');
    api.get(`/user/orders/delivery-estimate?partnerId=${partnerId}&addressId=${selectedAddr}&subtotal=${subtotal}&platform=damndeal&productIds=${productIds}&paymentMethod=${paymentMethod}`)
      .then(res => setEstimate(res.estimate))
      .catch(() => {});
  }, [selectedAddr, partnerId, subtotal, paymentMethod, items]);

  // Pincode-based delivery estimate
  useEffect(() => {
    const addr = addresses.find(a => a._id === selectedAddr);
    if (!addr?.pincode) { setPincodeEst(null); return; }
    api.get(`/user/check-pincode?pincode=${addr.pincode}`)
      .then(res => setPincodeEst(res))
      .catch(() => setPincodeEst(null));
  }, [selectedAddr, addresses]);

  const deliveryFee = estimate?.deliveryFee || 0;
  const platformFee = estimate?.platformFee || 0;
  const codFee = (paymentMethod === 'cod' ? (estimate?.codFee || 0) : 0);
  // US sales tax — added on top (pass-through). 0 for India.
  const salesTaxRate = Number(estimate?.usSalesTaxRate || 0);
  const salesTax = IS_US && salesTaxRate > 0 ? Math.round(subtotal * salesTaxRate) / 100 : 0;
  const grandTotal = subtotal + deliveryFee + platformFee + codFee + salesTax;
  const selectedAddress = addresses.find(a => a._id === selectedAddr);
  const hasCjItem = items.some(i => i.cjVid);
  const cjEtaText = '10-20 days';

  // COD availability based on backend settings
  const codEnabled = estimate ? (estimate.codEnabled !== false) : true;
  const codMaxAmount = Number(estimate?.codMaxAmount || 0);
  const codTooBig = codMaxAmount > 0 && subtotal > codMaxAmount;
  const codAvailable = codEnabled && !codTooBig && (pincodeEst ? pincodeEst.cod !== false : true);
  const codDisabledReason = !codEnabled
    ? 'Cash on Delivery is currently unavailable'
    : codTooBig
      ? `Not available for orders above ₹${codMaxAmount}`
      : (pincodeEst && pincodeEst.cod === false ? 'COD not available for this pincode' : '');

  // Auto-switch off COD if it became invalid
  useEffect(() => {
    if (paymentMethod === 'cod' && !codAvailable && estimate) {
      setPaymentMethod(IS_US ? 'stripe' : 'razorpay');
    }
  }, [codAvailable, paymentMethod, estimate]);

  // Load Razorpay checkout SDK once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if ((window as any).Razorpay) return;
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    document.body.appendChild(s);
  }, []);

  const handlePlaceOrder = async () => {
    if (!selectedAddr) { setError('Select a delivery address'); setShowError(true); return; }
    setPlacing(true);
    setPlacingText('Placing your order...');
    setError('');
    setShowError(false);
    try {
      // 1. Create order on backend (paymentStatus = pending for cod/razorpay)
      const orderRes = await api.post('/user/orders', {
        partnerId,
        platform: 'damndeal',
        items: items.map(i => ({
          product: i.productId.split('_')[0],
          quantity: i.quantity,
          ...(i.cjVid && { cjVid: i.cjVid }),
        })),
        addressId: selectedAddr,
        paymentMethod,
        note: note.trim() || undefined,
      });
      const placedOrder = orderRes.order;

      // 2a-US. Stripe (damndeal.com) → redirect to hosted Stripe Checkout
      if (paymentMethod === 'stripe') {
        setPlacingText('Redirecting to secure payment...');
        const res = await api.post('/user/payments/stripe/checkout', { orderId: placedOrder._id });
        if (!res.url) throw new Error('Could not start payment. Please try again.');
        clear();
        window.location.href = res.url; // Stripe returns to /order-success/:id?stripe_session=...
        return;
      }

      // 2a. COD → done
      if (paymentMethod === 'cod') {
        setPlacing(false);
        setOrderSuccess(true);
        clear();
        setTimeout(() => router.push('/orders'), 5000);
        return;
      }

      // 2b. Razorpay flow
      if (paymentMethod === 'razorpay') {
        setPlacingText('Opening payment gateway...');
        const rzData = await api.post('/user/payments/create', { orderId: placedOrder._id });
        if (!(window as any).Razorpay) {
          throw new Error('Payment gateway is loading, please retry in a moment.');
        }
        await new Promise<void>((resolve, reject) => {
          const rzp = new (window as any).Razorpay({
            key: rzData.key,
            amount: rzData.amount,
            currency: rzData.currency,
            order_id: rzData.razorpayOrderId,
            name: 'DamnDeal',
            description: `Order ${placedOrder.orderNumber}`,
            prefill: { name: selectedAddress?.label || '' },
            theme: { color: '#4F46E5' },
            handler: async (resp: any) => {
              try {
                await api.post('/user/payments/verify', {
                  razorpayOrderId: resp.razorpay_order_id,
                  razorpayPaymentId: resp.razorpay_payment_id,
                  razorpaySignature: resp.razorpay_signature,
                });
                resolve();
              } catch (e: any) {
                reject(new Error(e.message || 'Payment verification failed'));
              }
            },
            modal: {
              ondismiss: () => reject(new Error('Payment cancelled')),
            },
          });
          rzp.on('payment.failed', (resp: any) => {
            reject(new Error(resp?.error?.description || 'Payment failed'));
          });
          rzp.open();
        });
        setPlacing(false);
        setOrderSuccess(true);
        clear();
        setTimeout(() => router.push('/orders'), 5000);
        return;
      }

      // 2c. Wallet / other — already handled server-side as paid
      setPlacing(false);
      setOrderSuccess(true);
      clear();
      setTimeout(() => router.push('/orders'), 5000);
    } catch (e: any) {
      setPlacing(false);
      setError(e.message || 'Failed to place order. Please try again.');
      setShowError(true);
    }
  };

  /* ── Success overlay ── */
  if (orderSuccess) {
    return <SuccessAnimation />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 pb-24 md:pb-8">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1.5 -ml-1 rounded-lg hover:bg-gray-100 transition">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Checkout</h1>
            <p className="text-xs text-gray-400">{items.length} item{items.length > 1 ? 's' : ''} in your order</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-green-600">
            <ShieldCheck size={16} />
            <span className="text-xs font-medium hidden sm:inline">Secure Checkout</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="flex flex-col lg:flex-row gap-5">

          {/* ══════ LEFT COLUMN — Flipkart/Amazon native style ══════ */}
          <div className="flex-1 space-y-2.5">

            {/* Step 1: Delivery Address */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <header className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-gray-700 tracking-wide">
                  <span className="text-gray-400 mr-2">1</span>DELIVERY ADDRESS
                </h2>
                <button onClick={() => router.push('/address/new')} className="text-[12px] text-primary font-semibold hover:underline flex items-center gap-1">
                  <Plus size={12} /> Add new address
                </button>
              </header>
              <div className="p-3">
                {addresses.length === 0 ? (
                  <button onClick={() => router.push('/address/new')} className="w-full py-6 border border-dashed border-gray-300 rounded text-sm text-gray-500 hover:border-primary hover:text-primary flex flex-col items-center gap-2 transition">
                    <MapPin size={22} />
                    <span>Add your delivery address</span>
                  </button>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {addresses.map(addr => {
                      const active = selectedAddr === addr._id;
                      return (
                        <li key={addr._id}>
                          <button
                            onClick={() => setSelectedAddr(addr._id)}
                            className={`w-full text-left px-2 py-3 flex items-start gap-3 transition rounded ${active ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                          >
                            <span className={`mt-1 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? 'border-primary' : 'border-gray-300'}`}>
                              {active && <span className="w-2 h-2 rounded-full bg-primary" />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                <span className="text-[11px] font-bold text-gray-700 uppercase bg-gray-100 px-1.5 py-0.5 rounded-sm">{addr.label}</span>
                                {addr.isDefault && <span className="text-[10px] text-gray-500">Default</span>}
                              </div>
                              <p className="text-[13px] text-gray-800 leading-snug">
                                {addr.houseNo ? `${addr.houseNo}, ` : ''}{addr.address}
                              </p>
                              <p className="text-[12px] text-gray-500 mt-0.5">{addr.city}, {addr.state} <span className="font-semibold text-gray-700">{addr.pincode || addr.zip || ''}</span></p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            {/* Pincode Delivery Estimate — inline strip */}
            {selectedAddress && pincodeEst && (
              <div className={`rounded-md border px-4 py-2.5 flex items-center gap-2.5 ${pincodeEst.serviceable ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <Truck size={16} className={pincodeEst.serviceable ? 'text-green-700' : 'text-red-600'} />
                <div className="flex-1 min-w-0">
                  {pincodeEst.serviceable ? (
                    <p className="text-[13px] text-green-800">
                      <span className="font-semibold">
                        {hasCjItem
                          ? `Delivery in ${cjEtaText}`
                          : `Delivery in ${pincodeEst.estimatedDays} day${pincodeEst.estimatedDays > 1 ? 's' : ''}`}
                      </span>
                      <span className="text-green-700"> to {selectedAddress.pincode}</span>
                      <span className="text-green-600"> · {pincodeEst.cod ? 'COD available' : 'Prepaid only'}</span>
                    </p>
                  ) : (
                    <p className="text-[13px] font-semibold text-red-700">Delivery not available to {selectedAddress.pincode}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Payment Method */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <header className="px-4 py-2.5 border-b border-gray-100">
                <h2 className="text-[13px] font-semibold text-gray-700 tracking-wide">
                  <span className="text-gray-400 mr-2">2</span>PAYMENT METHOD
                </h2>
              </header>
              <ul className="divide-y divide-gray-100">
                {(IS_US
                  ? [
                      { key: 'stripe', label: 'Credit / Debit Card', desc: 'Pay securely via Stripe', icon: '💳' },
                    ]
                  : [
                      { key: 'razorpay', label: 'UPI / Cards / Netbanking', desc: 'Pay securely via Razorpay', icon: '💳' },
                      { key: 'cod', label: 'Cash on Delivery', desc: 'Pay when your order arrives', icon: '💵' },
                      // DamnDeal Wallet hidden for now
                    ]
                ).map(pm => {
                  const active = paymentMethod === pm.key;
                  const disabled = pm.key === 'cod' && !codAvailable;
                  const desc = disabled ? codDisabledReason : pm.desc;
                  return (
                    <li key={pm.key}>
                      <button
                        onClick={() => { if (!disabled) setPaymentMethod(pm.key); }}
                        disabled={disabled}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${active ? 'bg-primary/5' : 'hover:bg-gray-50'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${active ? 'border-primary' : 'border-gray-300'}`}>
                          {active && <span className="w-2 h-2 rounded-full bg-primary" />}
                        </span>
                        <span className="text-lg leading-none">{pm.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-gray-800">{pm.label}</p>
                          <p className={`text-[12px] ${disabled ? 'text-red-600' : 'text-gray-500'}`}>{desc}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Step 3: Order Note */}
            <section className="bg-white rounded-2xl shadow-sm border border-gray-100">
              <header className="px-4 py-2.5 border-b border-gray-100">
                <h2 className="text-[13px] font-semibold text-gray-700 tracking-wide">
                  <span className="text-gray-400 mr-2">3</span>ORDER NOTE <span className="text-gray-400 font-normal normal-case ml-1">(optional)</span>
                </h2>
              </header>
              <div className="p-3">
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Any special instructions for delivery..."
                  className="w-full bg-white rounded px-3 py-2 border border-gray-200 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none h-16 placeholder:text-gray-400"
                />
              </div>
            </section>
          </div>

          {/* ══════ RIGHT COLUMN ══════ */}
          <div className="lg:w-[380px] shrink-0">
            <div className="lg:sticky lg:top-20 space-y-4">

              {/* Items */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2">
                  <Package size={16} className="text-gray-500" />
                  <h3 className="text-sm font-bold text-gray-900">Your Items</h3>
                  <span className="text-xs text-gray-400 ml-auto">{items.length} item{items.length > 1 ? 's' : ''}</span>
                </div>
                <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
                  {items.map(item => (
                    <div key={item.productId} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                        {item.image && (
                          <Image src={imgUrl(item.image)} alt={item.name} width={48} height={48} className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                        <p className="text-[11px] text-gray-400">{item.unit || ''} × {item.quantity}</p>
                      </div>
                      <p className="text-sm font-bold text-gray-900 shrink-0">{cur}{(item.price * item.quantity).toFixed(0)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Price Details</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Price ({items.length} items)</span>
                    <span className="text-gray-700">{cur}{(subtotal + totalSavings).toFixed(0)}</span>
                  </div>
                  {totalSavings > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span className="font-medium">− {cur}{totalSavings.toFixed(0)}</span>
                    </div>
                  )}
                  {totalGst > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">GST (incl.)</span>
                      <span className="text-gray-400">{cur}{Math.round(totalGst)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Delivery Fee</span>
                    {estimate?.freeDeliveryApplied ? (
                      <span className="text-green-600 font-semibold">FREE</span>
                    ) : (
                      <span className="text-gray-700">{cur}{deliveryFee}</span>
                    )}
                  </div>
                  {platformFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Platform Fee</span>
                      <span className="text-gray-700">{cur}{platformFee}</span>
                    </div>
                  )}
                  {codFee > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">COD Charge</span>
                      <span className="text-gray-700">{cur}{codFee}</span>
                    </div>
                  )}
                  {salesTax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Sales Tax ({salesTaxRate}%)</span>
                      <span className="text-gray-700">{cur}{salesTax.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Delivery ETA */}
                  {pincodeEst?.serviceable && (hasCjItem || pincodeEst.estimatedDays) && (
                    <div className="flex justify-between items-center text-green-600 bg-green-50 -mx-4 px-4 py-2">
                      <span className="flex items-center gap-1.5"><Clock size={14} /> Est. Delivery</span>
                      <span className="font-semibold">{hasCjItem ? cjEtaText : `${pincodeEst.estimatedDays} day${pincodeEst.estimatedDays > 1 ? 's' : ''}`}</span>
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                    <span className="font-bold text-gray-900 text-base">Total Amount</span>
                    <span className="font-extrabold text-xl text-gray-900">{cur}{grandTotal.toFixed(IS_US ? 2 : 0)}</span>
                  </div>
                  {totalSavings > 0 && (
                    <p className="text-green-600 text-xs font-medium text-center bg-green-50 rounded-lg py-1.5 -mx-1">
                      🎉 You save {cur}{totalSavings.toFixed(0)} on this order
                    </p>
                  )}
                </div>
              </div>

              {/* Place Order Button (desktop) */}
              <button
                onClick={handlePlaceOrder}
                disabled={!selectedAddr || placing}
                className="hidden lg:flex w-full py-3.5 bg-primary text-white rounded-2xl font-bold text-sm hover:bg-primary-dark transition disabled:opacity-50 items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {placing ? (
                  <><Loader2 size={18} className="animate-spin" /> Placing Order...</>
                ) : (
                  <>Place Order · {cur}{grandTotal.toFixed(IS_US ? 2 : 0)}</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sticky place order bar */}
      {!placing && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-30 lg:hidden shadow-[0_-4px_12px_rgba(0,0,0,0.08)] safe-bottom">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Total</p>
              <p className="text-lg font-extrabold text-gray-900">{cur}{grandTotal.toFixed(IS_US ? 2 : 0)}</p>
            </div>
            <button
              onClick={handlePlaceOrder}
              disabled={!selectedAddr}
              className="flex-1 max-w-xs py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-dark transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              Place Order
            </button>
          </div>
        </div>
      )}

      {/* Processing overlay */}
      {placing && (
        <div className="fixed inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full border-4 border-primary/20 flex items-center justify-center">
              <Loader2 size={36} className="text-primary animate-spin" />
            </div>
            <div className="absolute -inset-3 rounded-full border-2 border-primary/10 animate-ping" />
          </div>
          <p className="text-lg font-bold text-gray-900 mb-1">{placingText}</p>
          <p className="text-sm text-gray-400">Please don&apos;t close this page</p>
          <div className="mt-8 flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}

      {/* Error modal */}
      {showError && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle size={32} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Order Failed</h3>
            <p className="text-sm text-gray-500 mb-5">{error}</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowError(false); setError(''); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => { setShowError(false); setError(''); handlePlaceOrder(); }} className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark">
                Retry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Success Animation Component ── */
function SuccessAnimation() {
  const [phase, setPhase] = useState(0);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 100);
    const t2 = setTimeout(() => setPhase(2), 600);
    const t3 = setTimeout(() => setPhase(3), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Generate particles with fixed positions
  const particles = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * 360;
    const distance = 80 + (i % 3) * 50;
    const rad = (angle * Math.PI) / 180;
    const x = Math.cos(rad) * distance;
    const y = Math.sin(rad) * distance;
    const colors = ['#22c55e','#f59e0b','#3b82f6','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316'];
    const shapes = ['rounded-full', 'rounded-sm', 'rounded-full'];
    const sizes = ['w-2 h-2', 'w-3 h-3', 'w-1.5 h-5', 'w-2.5 h-2.5'];
    return { x, y, color: colors[i % 8], shape: shapes[i % 3], size: sizes[i % 4], delay: i * 30 };
  });

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center px-6 overflow-hidden">

      {/* Bomb burst rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`absolute rounded-full border-[3px] border-green-300/40 transition-all ease-out ${phase >= 1 ? 'w-[500px] h-[500px] opacity-0' : 'w-0 h-0 opacity-100'}`} style={{ transitionDuration: '1.2s' }} />
        <div className={`absolute rounded-full border-[2px] border-green-400/30 transition-all ease-out ${phase >= 1 ? 'w-[350px] h-[350px] opacity-0' : 'w-0 h-0 opacity-100'}`} style={{ transitionDuration: '1s', transitionDelay: '0.1s' }} />
        <div className={`absolute rounded-full border-[2px] border-emerald-300/20 transition-all ease-out ${phase >= 1 ? 'w-[650px] h-[650px] opacity-0' : 'w-0 h-0 opacity-100'}`} style={{ transitionDuration: '1.4s', transitionDelay: '0.05s' }} />
      </div>

      {/* Green circle + checkmark */}
      <div className="relative">
        {/* Glow */}
        <div className={`absolute -inset-6 rounded-full bg-green-400/20 blur-2xl transition-all duration-700 ${phase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`} />

        {/* Bounce-in circle */}
        <div className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all ${phase >= 1 ? 'bg-green-500 scale-100' : 'bg-green-300 scale-0'}`} style={{ transitionDuration: '0.5s', transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
          <svg viewBox="0 0 24 24" className="w-14 h-14 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" style={{ strokeDasharray: 30, strokeDashoffset: phase >= 2 ? 0 : 30, transition: 'stroke-dashoffset 0.5s ease 0.1s' }} />
          </svg>
        </div>

        {/* Confetti particles - bomb burst */}
        {phase >= 1 && particles.map((p, i) => (
          <div
            key={i}
            className={`absolute ${p.size} ${p.shape}`}
            style={{
              background: p.color,
              left: '50%',
              top: '50%',
              opacity: 0,
              transform: 'translate(-50%, -50%) scale(1)',
              animation: `particle-burst 1.1s ease-out ${p.delay}ms forwards`,
              ['--px' as string]: `${p.x}px`,
              ['--py' as string]: `${p.y}px`,
            }}
          />
        ))}
      </div>

      {/* Text content */}
      <div className={`text-center mt-8 transition-all duration-500 ${phase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Order Confirmed
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900">Order Placed Successfully!</h1>
        <p className="text-lg text-gray-500 mt-2">Thank you for your order 🎉</p>
        <p className="text-sm text-gray-400 mt-4">Redirecting to your orders in <span className="font-bold text-green-600 text-base">{countdown}</span></p>

        {/* Progress bar */}
        <div className="mt-4 flex justify-center">
          <div className="h-1.5 w-56 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full" style={{ animation: 'progress-bar 5s linear forwards' }} />
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes particle-burst {
          0% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translate(calc(-50% + var(--px)), calc(-50% + var(--py))) scale(0) rotate(360deg);
            opacity: 0;
          }
        }
        @keyframes progress-bar {
          from { width: 0; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
