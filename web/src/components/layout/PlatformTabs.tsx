'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, Zap } from 'lucide-react';
import { useAppConfig } from '@/context/ConfigContext';

/**
 * The DamnDeal / DDGo switch, sitting above everything else.
 *
 * These are two different businesses sharing one account: a marketplace where a
 * courier ships in days, and quick commerce where a rider leaves a nearby store
 * in minutes. Prices, delivery promises and even which products exist differ
 * between them, so the customer has to be able to see which one they are in and
 * move between them in one tap — the same reason Flipkart puts Grocery beside
 * its main store rather than burying it in a menu.
 *
 * Hidden entirely when `ddgo_enabled` is off in Settings, so quick commerce can
 * be finished and stocked before anyone is offered a tab that leads nowhere.
 */
export default function PlatformTabs() {
  const config = useAppConfig();
  const pathname = usePathname() || '/';

  // Default off: a tab pointing at an empty store is worse than no tab.
  if (String(config.ddgo_enabled ?? '') !== 'true') return null;

  const onGo = pathname.startsWith('/grocery');

  return (
    <div className="bg-white border-b border-gray-100">
      <div className="max-w-[1400px] mx-auto flex">
        <Tab href="/" active={!onGo} label="DamnDeal" sub="Shopping" icon={<ShoppingBag size={15} />} accent="#EC1A74" />
        <Tab href="/grocery" active={onGo} label="DDGo" sub="In minutes" icon={<Zap size={15} />} accent="#0D7A30" />
      </div>
    </div>
  );
}

function Tab({
  href, active, label, sub, icon, accent,
}: {
  href: string; active: boolean; label: string; sub: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <Link
      href={href}
      className="flex-1 flex items-center justify-center gap-1.5 py-2 border-b-2 transition"
      style={{
        borderBottomColor: active ? accent : 'transparent',
        color: active ? accent : '#9AA0A6',
      }}
    >
      <span className="shrink-0">{icon}</span>
      <span className="leading-tight text-center">
        <span className="block text-[13px] font-extrabold">{label}</span>
        <span className="block text-[10px] font-medium opacity-80">{sub}</span>
      </span>
    </Link>
  );
}
