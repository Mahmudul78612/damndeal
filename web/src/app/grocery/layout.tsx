import DdgoCartBar from '@/components/ddgo/DdgoCartBar';

/**
 * Wraps every DDGo screen so the basket bar is present throughout the flow
 * rather than remembered on each page.
 */
export default function GroceryLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <DdgoCartBar />
    </>
  );
}
