'use client';

import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { DdgoCartProvider } from '@/context/DdgoCartContext';
import { ConfigProvider } from '@/context/ConfigContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider>
      <AuthProvider>
        <CartProvider>
          <DdgoCartProvider>
            {children}
          </DdgoCartProvider>
        </CartProvider>
      </AuthProvider>
    </ConfigProvider>
  );
}
