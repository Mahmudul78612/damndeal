import { AuthProvider } from '@/context/AuthContext';
import { LocationProvider } from '@/context/LocationContext';
import LoginModal from '@/components/LoginModal';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import MobileNav from '@/components/MobileNav';

/** Shopper-facing shell. The merchant console (/business) never renders this. */
export default function ShopLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <LocationProvider>
        <Header />
        <main className="flex-1 pb-[64px] md:pb-0">{children}</main>
        <Footer />
        <MobileNav />
        <LoginModal />
      </LocationProvider>
    </AuthProvider>
  );
}
