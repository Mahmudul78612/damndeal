'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Search, ShoppingCart, X } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { useAppConfig, useBrandLogo, useBrandName } from '@/context/ConfigContext';
import { useRouter, usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { api, imgUrl, CURRENCY_SYMBOL } from '@/lib/api';
import { Product } from '@/lib/types';

export default function MobileHeader() {
  const { itemCount } = useCart();
  const config = useAppConfig();
  const brandLogo = useBrandLogo('light');
  const brandName = useBrandName();
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  // Past this the logo row folds away and only a compact search bar remains,
  // which is all a shopper needs once they are into the page.
  const [compact, setCompact] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  const primaryColor = config.brand_primary_color || '#7C3AED';
  const appBarLightColor = (config.app_bar_color_light as string) || '';
  const headerFadeColor = appBarLightColor || primaryColor;
  const searchBgColor = '#FFFFFF';

  // Search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setProducts([]); return; }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api.get(`/user/search?q=${encodeURIComponent(query)}&limit=6`)
        .then(res => setProducts(res.products || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Solidify header on scroll so content doesn't show through.
  // rAF-throttled so a fast scroll never fights the main thread.
  useEffect(() => {
    let ticking = false;
    const apply = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      // Hysteresis: collapse at 84px but only expand again below 40px, so the
      // header cannot flicker while a finger hovers around the threshold.
      setCompact((was) => (was ? y > 40 : y > 84));
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(apply);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    apply();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);


  const handleSearch = () => {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    setQuery('');
    setProducts([]);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  // Only render on home page (mobile)
  if (pathname !== '/' && pathname !== '') return null;

  return (
    <header className="md:hidden sticky top-0 z-[80] relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-200"
        style={{
          background: `linear-gradient(to bottom, ${headerFadeColor}CC 0%, ${headerFadeColor}99 40%, ${headerFadeColor}66 70%, ${headerFadeColor}33 90%, ${headerFadeColor}00 100%)`,
          opacity: scrolled ? 0 : 1,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-[2] transition-opacity duration-200"
        style={{
          backgroundColor: headerFadeColor,
          opacity: scrolled ? 0.95 : 0,
        }}
      />
      <div className="relative z-10">
        <div
          className={`relative z-10 px-3 transition-[padding] duration-200 ${
            compact ? 'pt-2 pb-2' : 'pt-2.5 pb-3'
          }`}
          style={{ boxShadow: scrolled ? '0 2px 12px -6px rgba(17,9,40,.35)' : 'none' }}
        >
          {/* Search Bar with Suggestions */}
          {/* Search row. When the logo row is folded away the cart rides here,
              so it is never out of reach while scrolling. */}
          <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0" ref={containerRef}>
            <div
              className="flex items-center gap-2 rounded-full px-3 py-2 text-sm text-gray-500 transition shadow-md"
              style={{ backgroundColor: searchBgColor }}
            >
              <Search size={16} className="text-gray-400 shrink-0" strokeWidth={2} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearch();
                  }
                }}
                onFocus={() => setOpen(true)}
                placeholder="Search products..."
                className="flex-1 bg-transparent outline-none placeholder-gray-400 text-gray-800 text-sm font-medium"
              />
              {query && (
                <button 
                  onClick={() => { setQuery(''); setProducts([]); }} 
                  className="text-gray-400 hover:text-gray-600 shrink-0"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown Suggestions - only when typing */}
            {open && query.trim() && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg shadow-2xl border border-gray-100 max-h-[60vh] overflow-y-auto z-[200]">
                {loading ? (
                  <div className="p-3 space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />
                    ))}
                  </div>
                ) : products.length > 0 ? (
                  <div className="p-2">
                    {products.map(product => (
                      <Link
                        key={product._id}
                        href={`/product/${product._id}`}
                        onClick={() => { setOpen(false); setQuery(''); setProducts([]); }}
                        className="flex gap-2 p-2 rounded-lg hover:bg-gray-50 transition"
                      >
                        {product.images?.[0] && (
                          <Image
                            src={imgUrl(product.images[0])}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 line-clamp-2">
                            {product.name}
                          </p>
                          <p className="text-[10px] text-gray-500">
                            {CURRENCY_SYMBOL}{product.price?.toLocaleString()}
                          </p>
                        </div>
                      </Link>
                    ))}
                    <button
                      onClick={handleSearch}
                      className="w-full mt-2 py-2 text-xs font-semibold text-white rounded-lg"
                      style={{ backgroundColor: primaryColor }}
                    >
                      View All Results
                    </button>
                  </div>
                ) : (
                  <div className="p-4 text-center text-gray-500 text-xs">
                    No products found
                  </div>
                )}
              </div>
            )}
          </div>

          <Link
            href="/cart"
            aria-label="Cart"
            className="relative shrink-0 grid place-items-center rounded-full bg-white/20 w-9 h-9"
          >
            <ShoppingCart size={18} className="text-white" strokeWidth={2} />
            {itemCount > 0 && (
              <span className="absolute top-0.5 right-0.5 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-[14px] px-[3px] flex items-center justify-center">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </Link>
          </div>
        </div>

      </div>
    </header>
  );
}
