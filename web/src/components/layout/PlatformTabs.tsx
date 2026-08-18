'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Zap } from 'lucide-react';
import { useAppConfig, useBrandLogo, useBrandName } from '@/context/ConfigContext';
import { imgUrl } from '@/lib/api';

/**
 * The DamnDeal / DDGo switch, sitting above everything else.
 *
 * These are two different businesses sharing one account: a marketplace where a
 * courier ships in days, and quick commerce where a rider leaves a nearby store
 * in minutes. Prices, delivery promises and even which products exist differ
 * between them, so the customer has to see which one they are in and move
 * between them in one tap.
 *
 * Both tabs are next/link, so switching is a client-side navigation — no white
 * flash, no reload, and the cart and session survive the jump.
 *
 * Hidden entirely when `ddgo_enabled` is off, so quick commerce can be finished
 * and stocked before anyone is offered a tab that leads nowhere.
 */
export default function PlatformTabs() {
  const config = useAppConfig();
  const brandLogo = useBrandLogo();
  const brandName = useBrandName();
  const pathname = usePathname() || '/';

  if (String(config.ddgo_enabled ?? '') !== 'true') return null;

  const onGo = pathname.startsWith('/grocery');
  const ddgoLogo = (config.ddgo_logo_url as string) || '';

  return (
    <div className="bg-gradient-to-b from-[#F4F6FB] to-white border-b border-gray-100">
      <div className="max-w-[1400px] mx-auto px-2.5 py-2 flex gap-2">
        {/* Marketplace */}
        <Pill
          href="/" active={!onGo} activeBg="#F5E9FF" activeRing="#8000FF" sub="Shopping"
          logo={brandLogo ? (
            <Image
              src={brandLogo.startsWith('/assets') ? brandLogo : imgUrl(brandLogo)}
              alt={brandName}
              width={72}
              height={20}
              className="h-[18px] w-auto object-contain"
              priority
            />
          ) : (
            <span className="text-[14px] font-extrabold text-[#8000FF] leading-none">{brandName}</span>
          )}
        />

        {/* Quick commerce */}
        <Pill
          href="/grocery" active={onGo} activeBg="#E3F6E9" activeRing="#0D7A30" sub="In minutes"
          logo={ddgoLogo ? (
            <Image src={imgUrl(ddgoLogo)} alt="DDGo" width={72} height={20} className="h-[18px] w-auto object-contain" />
          ) : (
            <DdgoWordmark />
          )}
        />
      </div>
    </div>
  );
}

function Pill({
  href, active, activeBg, activeRing, logo, sub,
}: {
  href: string; active: boolean; activeBg: string; activeRing: string;
  logo: React.ReactNode; sub: string;
}) {
  return (
    <Link
      href={href}
      prefetch
      aria-current={active ? 'page' : undefined}
      className="flex-1 rounded-xl px-3 py-2 flex flex-col items-center justify-center gap-1 transition-all duration-150"
      style={
        active
          ? {
              background: activeBg,
              boxShadow: `inset 0 0 0 1.5px ${activeRing}, 0 1px 3px rgba(16,24,40,.08)`,
            }
          : { background: '#EEF1F6' }
      }
    >
      <span className={`flex items-center justify-center h-[20px] ${active ? '' : 'opacity-55 grayscale'}`}>
        {logo}
      </span>
      <span className="text-[10.5px] font-semibold text-gray-500 leading-none">{sub}</span>
    </Link>
  );
}

/** Text lockup used until a real DDGo logo is uploaded in Settings. */
function DdgoWordmark() {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-[18px] h-[18px] rounded-md bg-[#0D7A30] grid place-items-center">
        <Zap size={11} className="text-white" fill="white" />
      </span>
      <span className="text-[14px] font-extrabold tracking-tight text-[#0D7A30] leading-none">DDGo</span>
    </span>
  );
}
