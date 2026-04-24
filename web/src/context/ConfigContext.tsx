'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, imgUrl } from '@/lib/api';
import { AppConfig } from '@/lib/types';

const ConfigContext = createContext<AppConfig>({});
export const useAppConfig = () => useContext(ConfigContext);

const DEFAULT_LOGO = '/assets/logo.webp';

/**
 * Returns the resolved logo URL for the active theme.
 * variant: 'light' (default, used on light bg) | 'dark' (used on dark bg / footer)
 */
export function useBrandLogo(variant: 'light' | 'dark' = 'light'): string {
  const config = useAppConfig();
  const raw =
    variant === 'dark'
      ? (config.brand_logo_dark_url as string) || (config.brand_logo_url as string) || ''
      : (config.brand_logo_url as string) || '';
  if (!raw) return DEFAULT_LOGO;
  if (/^https?:\/\//i.test(raw)) return raw;
  return imgUrl(raw);
}

export function useBrandName(): string {
  const config = useAppConfig();
  return (config.brand_name as string) || 'DamnDeal';
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>({});

  useEffect(() => {
    api.get('/app-config')
      .then(res => setConfig(res.config || {}))
      .catch(() => {});
  }, []);

  return (
    <ConfigContext.Provider value={config}>
      {children}
    </ConfigContext.Provider>
  );
}
