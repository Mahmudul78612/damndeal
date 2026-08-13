import type { Metadata } from 'next';
import { Manrope, Baloo_2 } from 'next/font/google';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', weight: ['400', '500', '600', '700', '800'] });
const baloo = Baloo_2({ subsets: ['latin'], variable: '--font-baloo', weight: ['600', '700', '800'] });

export const metadata: Metadata = {
  title: {
    default: 'DamnDeal Coupons — Claim deals from local brands, clinics & stores',
    template: '%s | DamnDeal Coupons',
  },
  description:
    'The coupon marketplace: discover offers from cafés, clinics, salons, gyms and brands. Claim a unique code with QR and redeem in-store or online.',
  keywords: ['coupons', 'deals', 'offers', 'promo codes', 'discounts', 'local deals', 'DamnDeal'],
  openGraph: {
    siteName: 'DamnDeal Coupons',
    type: 'website',
  },
};

/**
 * Root layout is deliberately bare: it only owns <html>/<body> and the fonts.
 *
 * The shopper chrome (header, footer, mobile nav, login modal) lives in the
 * (shop) route group, and the merchant console has its own shell under
 * /business. Neither should ever render the other's navigation.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${baloo.variable}`}>
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
