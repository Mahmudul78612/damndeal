import DdgoCartBar from '@/components/ddgo/DdgoCartBar';
import DdgoBottomNav from '@/components/ddgo/DdgoBottomNav';

/**
 * The DDGo app shell: every quick-commerce screen gets the floating basket bar
 * and the bottom tab bar, so navigation and the running basket follow the whole
 * flow instead of being remembered on each page.
 */
export default function GroceryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Room for the bottom nav on mobile so nothing hides behind it. */}
      <div className="pb-16 md:pb-0">{children}</div>
      <DdgoCartBar />
      <DdgoBottomNav />
    </>
  );
}
