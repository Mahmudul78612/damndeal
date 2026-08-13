import type { Metadata } from 'next';
import { BusinessProvider } from '@/context/BusinessContext';
import BusinessShell from './BusinessShell';

export const metadata: Metadata = {
  title: { default: 'Business Console', template: '%s | DamnDeal Business' },
  description: 'Run your coupons, outlets and team on DamnDeal.',
  robots: { index: false, follow: false },
};

/** Merchant console shell — no shopper header, footer or mobile nav. */
export default function BusinessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <BusinessProvider>
      <BusinessShell>{children}</BusinessShell>
    </BusinessProvider>
  );
}
