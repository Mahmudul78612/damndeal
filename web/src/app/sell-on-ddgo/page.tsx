'use client';

import Link from 'next/link';
import {
  Store, Zap, Wallet, Bike, BarChart3, PackageCheck, ChevronRight, Check,
} from 'lucide-react';
import { IS_US } from '@/lib/api';

/**
 * "List your shop on DDGo" — the entry point for a store.
 *
 * Deliberately concrete rather than salesy: a shop owner deciding whether to
 * spend an evening on paperwork wants to know what they control, who delivers,
 * and when they get paid. Every claim here maps to something the partner portal
 * actually does, so the page cannot drift ahead of the product.
 */

const CURRENCY = IS_US ? '$' : '₹';

const WHAT_YOU_GET = [
  {
    icon: <Store size={20} />,
    title: 'Your own store panel',
    body: 'Sign in with your phone. Your shop, your products, your orders — nobody else sees them.',
  },
  {
    icon: <Zap size={20} />,
    title: 'Orders from customers near you',
    body: 'You set how far you deliver. Only people inside that circle see your shop, so you never get an order you cannot reach.',
  },
  {
    icon: <PackageCheck size={20} />,
    title: 'You accept or decline',
    body: 'Every order lands in your panel first. Out of stock or closing early? Decline it — nothing is forced on you.',
  },
  {
    icon: <Bike size={20} />,
    title: 'Your own delivery boys',
    body: 'Add your riders from your panel and assign each order to one of them. You stay in control of the last mile.',
  },
  {
    icon: <BarChart3 size={20} />,
    title: 'Sales you can actually read',
    body: 'Orders, revenue, what sells and what sits. Per day, per product.',
  },
  {
    icon: <Wallet size={20} />,
    title: 'Payouts to your bank',
    body: 'Every settled order shows in your payouts page with what it earned you.',
  },
];

const STEPS = [
  { n: 1, t: 'Sign in with your phone', d: 'One OTP. No forms yet.' },
  { n: 2, t: 'Tell us about the shop', d: 'Name, address, and your shop pinned on the map. Upload your ID and shop documents.' },
  { n: 3, t: 'We verify', d: 'Our team checks the documents. You are told either way, with a reason if something is missing.' },
  { n: 4, t: 'Add your products', d: 'Photos, price, stock. Each one is reviewed before it goes live, so the catalogue stays clean.' },
  { n: 5, t: 'Start taking orders', d: 'Set your delivery radius and open the shop. Customers nearby start seeing you.' },
];

export default function SellOnDdgoPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="bg-[#0D7A30] text-white">
        <div className="max-w-[1000px] mx-auto px-4 py-12 md:py-16">
          <p className="text-[12px] font-bold tracking-wide uppercase opacity-80 mb-2">DamnDeal Go</p>
          <h1 className="text-2xl md:text-4xl font-extrabold leading-tight max-w-2xl">
            Sell from your shop to customers nearby
          </h1>
          <p className="text-[14px] md:text-[16px] opacity-90 mt-3 max-w-xl leading-relaxed">
            Put your shop on DDGo. You decide how far you deliver, which orders you take,
            and who delivers them. We bring the customers and handle the payments.
          </p>
          <div className="flex flex-wrap gap-3 mt-7">
            {/* Plain anchor on purpose: /partner/ is the static portal served
                by nginx, not a route in this app, so the client-side router
                must not try to handle it. */}
            <a
              href="/partner/"
              className="bg-white text-[#0D7A30] font-extrabold text-[15px] px-6 py-3 rounded-xl inline-flex items-center gap-2 hover:opacity-90 transition"
            >
              Start now <ChevronRight size={17} />
            </a>
            <a
              href="#how"
              className="border border-white/40 font-bold text-[15px] px-6 py-3 rounded-xl inline-flex items-center hover:bg-white/10 transition"
            >
              How it works
            </a>
          </div>
          <p className="text-[12px] opacity-75 mt-4">
            No listing fee to join. You are paid per order.
          </p>
        </div>
      </div>

      {/* What you get */}
      <div className="max-w-[1000px] mx-auto px-4 py-12">
        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 mb-1">What you get</h2>
        <p className="text-[13.5px] text-gray-500 mb-7">Everything below is in your panel from day one.</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WHAT_YOU_GET.map((f) => (
            <div key={f.title} className="border border-gray-100 rounded-2xl p-5 hover:shadow-md transition">
              <div className="w-10 h-10 rounded-xl bg-[#0D7A30]/10 text-[#0D7A30] grid place-items-center mb-3">
                {f.icon}
              </div>
              <h3 className="font-bold text-[14.5px] text-gray-900 mb-1">{f.title}</h3>
              <p className="text-[13px] text-gray-600 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div id="how" className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-[1000px] mx-auto px-4 py-12">
          <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 mb-1">How to get listed</h2>
          <p className="text-[13.5px] text-gray-500 mb-7">Five steps. Most shops finish the paperwork in one sitting.</p>

          <div className="space-y-3">
            {STEPS.map((s) => (
              <div key={s.n} className="bg-white border border-gray-100 rounded-2xl p-4 flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-[#0D7A30] text-white font-extrabold text-[13px] grid place-items-center shrink-0">
                  {s.n}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-[14.5px] text-gray-900">{s.t}</h3>
                  <p className="text-[13px] text-gray-600 mt-0.5 leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* What you need */}
      <div className="max-w-[1000px] mx-auto px-4 py-12">
        <h2 className="text-xl md:text-2xl font-extrabold text-gray-900 mb-1">Keep these ready</h2>
        <p className="text-[13.5px] text-gray-500 mb-6">
          Verification is faster when the documents are to hand.
        </p>
        <ul className="grid sm:grid-cols-2 gap-2.5 max-w-2xl">
          {[
            'Shop name and full address',
            'Your ID proof',
            'Shop photo',
            'Bank account details, for payouts',
            IS_US ? 'Tax ID (EIN or SSN)' : 'GST number, if you have one',
            'The phone number you want to sign in with',
          ].map((t) => (
            <li key={t} className="flex items-start gap-2 text-[13.5px] text-gray-700">
              <Check size={16} className="text-[#0D7A30] shrink-0 mt-0.5" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Close */}
      <div className="max-w-[1000px] mx-auto px-4 pb-16">
        <div className="bg-[#0D7A30] rounded-2xl px-6 py-10 text-center text-white">
          <h2 className="text-xl md:text-2xl font-extrabold">Ready to open your shop on DDGo?</h2>
          <p className="text-[13.5px] opacity-90 mt-2 mb-6">
            Sign in with your phone — you can fill the rest in later.
          </p>
          <a
            href="/partner/"
            className="bg-white text-[#0D7A30] font-extrabold text-[15px] px-7 py-3 rounded-xl inline-flex items-center gap-2 hover:opacity-90 transition"
          >
            Start now <ChevronRight size={17} />
          </a>
          <p className="text-[12px] opacity-75 mt-5">
            Questions first? Write to us and a person will reply —{' '}
            <Link href="/contact" className="underline font-semibold">contact us</Link>.
          </p>
        </div>

        <p className="text-[11.5px] text-gray-400 text-center mt-5">
          Prices shown to customers are yours. Commission and payout terms are confirmed
          in writing before your shop goes live. Amounts are in {CURRENCY}.
        </p>
      </div>
    </div>
  );
}
