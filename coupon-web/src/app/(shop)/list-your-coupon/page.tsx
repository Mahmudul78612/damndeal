import type { Metadata } from 'next';
import Link from 'next/link';
import { apiServer, serverRegion, currencyFor } from '@/lib/server';
import { Category } from '@/lib/types';
import { Store, QrCode, Code2, Megaphone, Check, ArrowRight } from 'lucide-react';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'List your coupon — reach thousands of local shoppers',
  description:
    'Brands, clinics, salons and stores: list coupons on DamnDeal Coupons, verify redemptions from our portal or your own website via API. Start free.',
};

export default async function ListYourCouponPage() {
  const region = await serverRegion();
  const cur = currencyFor(region);
  const res = await apiServer<{ items: Category[] }>('/coupons/categories');
  const cats = (res?.items || []).filter((c) => c.packs?.length);

  return (
    <div>
      {/* Hero */}
      <section className="bg-band">
        <div className="max-w-[1100px] mx-auto px-4 py-14 md:py-20 text-center">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-widest text-primary bg-primary-light rounded-full px-3 py-1.5 mb-4">
            <Store size={12} /> For brands · clinics · local pros
          </p>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            Your offer, on every<br className="hidden sm:block" /> shopper&apos;s phone.
          </h1>
          <p className="text-gray-500 text-[15px] mt-4 max-w-xl mx-auto">
            List a coupon in minutes. Customers claim unique codes; you verify with one tap in our
            portal — or plug redemption into your own website with an API key. No website needed to start.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-7">
            <Link href="/vendor" className="bg-primary hover:bg-primary-dark text-white font-extrabold text-sm px-7 py-3.5 rounded-xl shadow-lg shadow-primary/25 transition">
              Create your coupon →
            </Link>
            <a href="#api" className="bg-white border border-gray-200 hover:border-primary text-gray-700 font-bold text-sm px-7 py-3.5 rounded-xl transition">
              See the verify API
            </a>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-[1100px] mx-auto px-4 py-14">
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: <Megaphone size={20} />, t: '1 · List your offer', d: 'Pick a category, set the offer (% off, flat, BOGO, freebie — fully custom text) and quota. Goes live after a quick review.' },
            { icon: <QrCode size={20} />, t: '2 · Customers claim', d: 'Each customer gets a unique one-time code + QR. No screenshots, no reuse, no fake coupons.' },
            { icon: <Code2 size={20} />, t: '3 · You verify', d: 'Scan or type the code in your vendor portal — or verify from your own site with your API key.' },
          ].map((x, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-6">
              <span className="w-10 h-10 rounded-xl bg-primary text-white grid place-items-center mb-3">{x.icon}</span>
              <p className="font-extrabold text-[15px]">{x.t}</p>
              <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-band py-14">
        <div className="max-w-[1100px] mx-auto px-4">
          <h2 className="text-2xl font-extrabold text-center">Simple coupon packs</h2>
          <p className="text-sm text-gray-500 text-center mt-1 mb-8">
            Start free with 50 coupons. Buy packs per category when you scale — prices in {region === 'US' ? 'USD' : 'INR'}.
          </p>
          <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-gray-400">Free start</p>
              <p className="text-3xl font-extrabold mt-2">{cur}0</p>
              <ul className="mt-4 space-y-2 text-[13px] text-gray-600">
                {['50 coupon credits', 'Unique codes + QR', 'Portal verification', 'Brand page'].map((f) => (
                  <li key={f} className="flex gap-2"><Check size={15} className="text-emerald-500 shrink-0 mt-0.5" /> {f}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white border-2 border-primary rounded-2xl p-6 relative shadow-lg shadow-primary/10">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full">Popular</span>
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-primary">Coupon packs</p>
              <p className="text-3xl font-extrabold mt-2">100–1000<span className="text-sm font-bold text-gray-400"> coupons</span></p>
              <ul className="mt-4 space-y-2 text-[13px] text-gray-600">
                {['Priced per category (below)', 'Everything in Free', 'API key + verify API', 'Claim analytics'].map((f) => (
                  <li key={f} className="flex gap-2"><Check size={15} className="text-emerald-500 shrink-0 mt-0.5" /> {f}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber-500">Sponsored</p>
              <p className="text-3xl font-extrabold mt-2">Featured</p>
              <ul className="mt-4 space-y-2 text-[13px] text-gray-600">
                {['Top of homepage placement', '“Sponsored” spotlight badge', 'Priority in category pages', 'Talk to us to book a slot'].map((f) => (
                  <li key={f} className="flex gap-2"><Check size={15} className="text-emerald-500 shrink-0 mt-0.5" /> {f}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Category pack table */}
          {cats.length > 0 && (
            <div className="max-w-3xl mx-auto mt-8 bg-white border border-gray-200 rounded-2xl overflow-hidden overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-band text-left text-gray-500">
                    <th className="px-5 py-3 font-bold">Category</th>
                    {cats[0].packs!.map((p) => (
                      <th key={p.claims} className="px-5 py-3 font-bold text-right">{p.claims} coupons</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cats.map((c) => (
                    <tr key={c._id} className="border-t border-gray-100">
                      <td className="px-5 py-3 font-bold text-gray-700">{c.icon} {c.name}</td>
                      {c.packs!.map((p) => (
                        <td key={p.claims} className="px-5 py-3 text-right font-mono font-bold text-gray-800">
                          {cur}{(region === 'US' ? p.priceUSD : p.priceINR).toLocaleString()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* API */}
      <section id="api" className="max-w-[1100px] mx-auto px-4 py-14">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-primary mb-2">Verify API</p>
            <h2 className="text-2xl font-extrabold leading-snug">Have your own website?<br />Verify codes from it.</h2>
            <p className="text-[14px] text-gray-500 mt-3 leading-relaxed">
              Generate an API key in your vendor portal and call two endpoints from your backend —
              <b> verify</b> (check a code) and <b>redeem</b> (consume it, single-use). Works with any stack.
            </p>
            <Link href="/vendor" className="inline-flex items-center gap-1.5 mt-5 text-primary font-bold text-sm hover:underline">
              Get your API key <ArrowRight size={15} />
            </Link>
          </div>
          <div className="bg-ink rounded-2xl p-5 text-[12.5px] font-mono text-emerald-300/90 overflow-x-auto leading-relaxed">
            <p className="text-white/40 mb-2"># Verify a customer&apos;s code</p>
            <p>curl -X POST https://coupon.damndeal.{region === 'US' ? 'com' : 'in'}/api/coupons/api/verify \</p>
            <p>&nbsp;&nbsp;-H &quot;x-api-key: dck_your_key&quot; \</p>
            <p>&nbsp;&nbsp;-H &quot;Content-Type: application/json&quot; \</p>
            <p>&nbsp;&nbsp;-d &apos;{'{'}&quot;code&quot;: &quot;DD-8F2K-9QX1&quot;{'}'}&apos;</p>
            <p className="text-white/40 mt-4 mb-2"># → {'{'} valid: true, offer: {'{'} … {'}'} {'}'}</p>
            <p className="text-white/40 mb-2"># Then consume it (single use)</p>
            <p>curl -X POST …/api/coupons/api/redeem -H &quot;x-api-key: …&quot; -d &apos;{'{'}&quot;code&quot;: &quot;DD-8F2K-9QX1&quot;{'}'}&apos;</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1100px] mx-auto px-4 pb-16">
        <div className="rounded-2xl bg-primary text-white text-center py-12 px-6">
          <h2 className="text-2xl md:text-3xl font-extrabold">Put your offer in front of shoppers today.</h2>
          <p className="text-white/80 text-sm mt-2">Free to start — your first 50 coupons are on us.</p>
          <Link href="/vendor" className="inline-block mt-6 bg-white text-primary font-extrabold text-sm px-8 py-3.5 rounded-xl hover:bg-gray-100 transition">
            Open vendor portal →
          </Link>
        </div>
      </section>
    </div>
  );
}
