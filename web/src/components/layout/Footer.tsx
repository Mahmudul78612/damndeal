'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Globe, Phone, Mail, MapPin, Building2 } from 'lucide-react';
import { useAppConfig, useBrandLogo, useBrandName } from '@/context/ConfigContext';

export default function Footer() {
  const config = useAppConfig();
  const brandLogo = useBrandLogo('dark');
  const brandName = useBrandName();
  const supportPhone = config.support_phone || '+91-76968-27211';
  const supportEmail = config.support_email || 'info@damndeal.in';

  return (
    <footer className="hidden md:block bg-gray-900 text-gray-300 mt-8">
      <div className="max-w-[1400px] mx-auto px-4 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* Brand + Contact */}
          <div className="col-span-4">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-extrabold text-xs">DD</span>
              </div>
              <Image src={brandLogo} alt={brandName} width={120} height={36} className="h-8 w-auto object-contain brightness-0 invert" unoptimized />
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Shop the best deals online. Electronics, fashion, home & more at unbeatable prices.
            </p>
            <a href={`tel:${supportPhone}`} className="flex items-center gap-1.5 mt-3 text-xs text-gray-400 hover:text-white transition">
              <Phone size={12} /> {supportPhone}
            </a>
            <a href={`mailto:${supportEmail}`} className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-400 hover:text-white transition">
              <Mail size={12} /> {supportEmail}
            </a>

            {config.instagram_url && (
              <a
                href={config.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs text-gray-400 hover:text-pink-400 transition"
              >
                <Globe size={14} /> Instagram
              </a>
            )}
          </div>

          {/* Quick Links */}
          <div className="col-span-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Quick Links</h3>
            <ul className="space-y-1.5">
              {[
                { href: '/', label: 'Home' },
                { href: '/categories', label: 'All Categories' },
                { href: '/orders', label: 'My Orders' },
                { href: '/wallet', label: 'Wallet' },
                { href: '/account', label: 'My Account' },
                { href: '/addresses', label: 'Addresses' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-xs text-gray-400 hover:text-white transition">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="col-span-2">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3">Legal</h3>
            <ul className="space-y-1.5">
              {[
                { href: '/legal/terms', label: 'Terms & Conditions' },
                { href: '/legal/privacy', label: 'Privacy Policy' },
                { href: '/legal/refund', label: 'Refund Policy' },
                { href: '/legal/vendor', label: 'Vendor / Partner Terms' },
              ].map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-xs text-gray-400 hover:text-white transition">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Info */}
          <div className="col-span-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Building2 size={13} /> Company Info
            </h3>
            <div className="space-y-1.5 text-xs text-gray-400 leading-relaxed">
              <p className="text-gray-200 font-semibold">DAMNDEAL INDIA PRIVATE LIMITED</p>
              <p className="flex items-start gap-1.5">
                <MapPin size={12} className="mt-0.5 shrink-0" />
                <span>Booth No. 1426, Chotti Baradari, Patiala, Punjab, India - 147001</span>
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1.5 border-t border-gray-800">
                <p>
                  <span className="text-gray-500">CIN</span><br />
                  <span className="text-gray-300">U47912PB2025PTC064208</span>
                </p>
                <p>
                  <span className="text-gray-500">GSTIN</span><br />
                  <span className="text-gray-300">03AALCD6016H1ZW</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800">
        <div className="max-w-[1400px] mx-auto px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} DamnDeal India Private Limited. All rights reserved.</p>
          <p className="text-xs text-gray-500">Made with ❤️ in India</p>
        </div>
      </div>
    </footer>
  );
}
