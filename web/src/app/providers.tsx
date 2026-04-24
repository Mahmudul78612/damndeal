'use client';

import { AuthProvider } from '@/context/AuthContext';
import { CartProvider } from '@/context/CartContext';
import { ConfigProvider } from '@/context/ConfigContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider>
      <AuthProvider>
        <CartProvider>
          {children}
        </CartProvider>
      </AuthProvider>
    </ConfigProvider>
  );
}
