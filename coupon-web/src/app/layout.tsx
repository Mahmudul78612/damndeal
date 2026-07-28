import type { Metadata } from 'next';
import { Manrope, Baloo_2 } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LocationProvider } from '@/context/LocationContext';
import LoginModal from '@/components/LoginModal';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobileNav from '@/components/MobileNav';

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${manrope.variable} ${baloo.variable}`}>
      <body className="min-h-screen flex flex-col">
        <AuthProvider>
          <LocationProvider>
          <Header />
          <main className="flex-1 pb-[64px] md:pb-0">{children}</main>
          <Footer />
          <MobileNav />
          <LoginModal />
          </LocationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
