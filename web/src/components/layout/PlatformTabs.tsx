'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAppConfig, useBrandLogo, useBrandName } from '@/context/ConfigContext';
import { imgUrl } from '@/lib/api';

/**
 * The DamnDeal / DDGo switch — the Flipkart-style pair of cards at the very top.
 *
 * Two different businesses share one account: a marketplace where a courier
 * ships in days, and quick commerce where a rider leaves a nearby store in
 * minutes. The customer has to see which one they are in and move between them
 * in one tap.
 *
 * Both are next/link, so switching is a client-side navigation — no reload, and
 * the two carts (separate on purpose) both survive the jump. Hidden entirely
 * when `ddgo_enabled` is off, so the tab never leads to an empty store.
 */
export default function PlatformTabs() {
  const config = useAppConfig();
  const brandLogo = useBrandLogo();
  const brandName = useBrandName();
  const pathname = usePathname() || '/';

  if (String(config.ddgo_enabled ?? '') !== 'true') return null;

  const onGo = pathname.startsWith('/grocery');
  const ddgoLogo = (config.ddgo_logo_url as string) || '/assets/ddgo-logo.png';
  const src = (u: string) => (u.startsWith('/') || u.startsWith('http') ? u : imgUrl(u));

  // The strip carries the brand header colour, so the tabs and the purple
  // search bar under them read as one header rather than a white gap on top.
  const headerBg =
    (config.app_bar_color_light as string) ||
    (config.brand_primary_color as string) ||
    '#7C3AED';

  return (
    <div style={{ backgroundColor: headerBg }}>
      <div className="max-w-[1400px] mx-auto px-2.5 pt-2 pb-2.5 flex gap-2.5 safe-top">
        <TabCard
          href="/" active={!onGo} sub="Shopping"
          ring="#8000FF" tint="#F6ECFF"
          logo={<Image src={src(brandLogo)} alt={brandName} width={110} height={26}
                  className="h-[22px] w-auto object-contain" priority unoptimized />}
        />
        <TabCard
          href="/grocery" active={onGo} sub="In minutes"
          ring="#0D7A30" tint="#E6F6EC"
          logo={<Image src={src(ddgoLogo)} alt="DDGo" width={110} height={26}
                  className="h-[22px] w-auto object-contain" unoptimized />}
        />
      </div>
    </div>
  );
}

function TabCard({
  href, active, sub, ring, tint, logo,
}: {
  href: string; active: boolean; sub: string; ring: string; tint: string; logo: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? 'page' : undefined}
      className="flex-1 rounded-2xl px-3 py-2 flex flex-col items-center justify-center gap-0.5 transition-all duration-150"
      style={
        active
          ? { background: tint, boxShadow: `inset 0 0 0 2px ${ring}, 0 2px 8px rgba(16,24,40,.06)` }
          : { background: '#F2F4F7' }
      }
    >
      <span className={`h-[24px] flex items-center ${active ? '' : 'opacity-45 grayscale'}`}>
        {logo}
      </span>
      <span
        className="text-[10.5px] font-bold leading-none"
        style={{ color: active ? ring : '#98A2B3' }}
      >
        {sub}
      </span>
    </Link>
  );
}
