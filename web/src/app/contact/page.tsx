'use client';

import Link from 'next/link';
import { Mail, Phone, MessageCircle, Clock, Package, ShieldCheck, ChevronRight } from 'lucide-react';
import { useAppConfig } from '@/context/ConfigContext';
import { IS_US } from '@/lib/api';

/**
 * Support page.
 *
 * This is the Support URL we hand to the App Store and Play Store, so it has
 * to keep working and show a real, reachable contact. The numbers come from
 * Settings rather than being hard-coded, so support can be moved without a
 * deploy; the fallbacks are the values that are live today.
 */
const FALLBACK = {
  email: IS_US ? 'support@damndeal.com' : 'support@damndeal.in',
  phone: IS_US ? '' : '+917696827211',
  whatsapp: IS_US ? '' : '+917696827211',
};

function tel(n: string) {
  return n.replace(/[^\d+]/g, '');
}

export default function ContactPage() {
  const config = useAppConfig();

  const email = (config.support_email as string) || FALLBACK.email;
  const phone = (config.support_phone as string) || FALLBACK.phone;
  const phoneAlt = (config.support_phone_alt as string) || '';
  const whatsapp = (config.support_whatsapp as string) || FALLBACK.whatsapp;
  const hours = (config.support_hours as string) || 'Monday to Saturday, 10:00 AM to 7:00 PM IST';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        <div className="mb-6">
          <h1 className="text-xl md:text-3xl font-bold text-gray-900">Contact &amp; Support</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            Any question about an order, a return or a refund — reach us here and a real person will reply.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <a
            href={`mailto:${email}`}
            className="group bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:border-violet-200 transition-all flex items-start gap-3"
          >
            <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white shadow-md">
              <Mail size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm md:text-base font-bold text-gray-900 group-hover:text-violet-600 transition">Email</h3>
              <p className="text-xs text-gray-600 mt-0.5 break-all">{email}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">We reply within 24 hours</p>
            </div>
          </a>

          {phone && (
            <a
              href={`tel:${tel(phone)}`}
              className="group bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:border-violet-200 transition-all flex items-start gap-3"
            >
              <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md">
                <Phone size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm md:text-base font-bold text-gray-900 group-hover:text-violet-600 transition">Call us</h3>
                <p className="text-xs text-gray-600 mt-0.5">{phone}</p>
                {phoneAlt && <p className="text-xs text-gray-600">{phoneAlt}</p>}
              </div>
            </a>
          )}

          {whatsapp && (
            <a
              href={`https://wa.me/${tel(whatsapp).replace(/^\+/, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:border-violet-200 transition-all flex items-start gap-3"
            >
              <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-md">
                <MessageCircle size={22} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm md:text-base font-bold text-gray-900 group-hover:text-violet-600 transition">WhatsApp</h3>
                <p className="text-xs text-gray-600 mt-0.5">{whatsapp}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Fastest way to reach us</p>
              </div>
            </a>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start gap-3">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md">
              <Clock size={22} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm md:text-base font-bold text-gray-900">Support hours</h3>
              <p className="text-xs text-gray-600 mt-0.5">{hours}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          <Link
            href="/orders"
            className="group bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:border-violet-200 transition-all flex items-center gap-3"
          >
            <Package size={20} className="text-violet-600 shrink-0" />
            <span className="flex-1 text-sm font-semibold text-gray-900">Track or return an order</span>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-violet-500 transition" />
          </Link>

          <Link
            href="/legal"
            className="group bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:border-violet-200 transition-all flex items-center gap-3"
          >
            <ShieldCheck size={20} className="text-violet-600 shrink-0" />
            <span className="flex-1 text-sm font-semibold text-gray-900">Policies &amp; privacy</span>
            <ChevronRight size={16} className="text-gray-300 group-hover:text-violet-500 transition" />
          </Link>
        </div>
      </div>
    </div>
  );
}
