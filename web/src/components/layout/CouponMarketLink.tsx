'use client';

import { useAppConfig } from '@/context/ConfigContext';
import { Ticket } from 'lucide-react';

/**
 * Entry point from the storefront to the coupon marketplace.
 *
 * No SDK or token handshake is needed: coupon.damndeal.in is a sibling of
 * damndeal.in, and the signed-in session is mirrored into a cookie scoped to
 * the parent domain (lib/sso.ts). A plain link therefore arrives already
 * signed in. The same holds for damndeal.com → coupon.damndeal.com.
 *
 * Admin-controlled from Settings:
 *   coupon_market_enabled  "true" to show it
 *   coupon_market_url      defaults to coupon.<current domain>
 *   coupon_market_label    defaults to "Coupons"
 */
export function useCouponMarket() {
  const config = useAppConfig();

  const enabled = String(config.coupon_market_enabled ?? '') === 'true';
  const label = (config.coupon_market_label as string) || 'Coupons';

  let url = (config.coupon_market_url as string) || '';
  if (!url && typeof window !== 'undefined') {
    const h = window.location.hostname;
    const root = h.split('.').slice(-2).join('.');   // damndeal.in / damndeal.com
    url = `https://coupon.${root}`;
  }

  return { enabled: enabled && !!url, url, label };
}

/** Pill-style link for the category bar / desktop nav. */
export default function CouponMarketLink({ className = '' }: { className?: string }) {
  const { enabled, url, label } = useCouponMarket();
  if (!enabled) return null;

  return (
    <a
      href={url}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap font-semibold transition ${className}`}
    >
      <Ticket size={15} className="shrink-0" />
      {label}
    </a>
  );
}
