'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api, imgUrl, CURRENCY_SYMBOL } from "@/lib/api";
import { Product, Category } from '@/lib/types';
import { Search as SearchIcon, X, TrendingUp } from 'lucide-react';

export default function SearchDropdown() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  // Load categories once
  useEffect(() => {
    api.get('/categories?platform=damndeal')
      .then(res => setCategories(res.categories || []))
      .catch(() => {});
  }, []);

  // Search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setProducts([]); return; }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api.get(`/user/search?q=${encodeURIComponent(query)}&limit=8`)
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

  const submitSearch = () => {
    const q = query.trim();
    if (!q) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="flex-1 max-w-xl relative" ref={containerRef}>
      {/* Input */}
      <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-gray-200 focus-within:shadow-sm transition">
        <button onClick={submitSearch} aria-label="Search" className="text-gray-400 hover:text-gray-600 shrink-0">
          <SearchIcon size={16} />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submitSearch();
            }
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search products..."
          className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400 text-gray-800"
        />
        {query && (
          <button onClick={() => { setQuery(''); setProducts([]); }} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-gray-100 max-h-[70vh] overflow-y-auto z-50">
          {/* Product results */}
          {query.trim() && (
            <>
              {loading ? (
                <div className="p-3 space-y-2">
                  {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-10 rounded" />)}
                </div>
              ) : products.length > 0 ? (
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase px-3 pt-2 pb-1">Products</p>
                  {products.map(p => (
                    <Link
                      key={p._id}
                      href={`/product/${p._id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition"
                    >
                      <div className="w-9 h-9 rounded bg-gray-100 overflow-hidden shrink-0">
                        <Image src={imgUrl(p.images?.[0])} alt="" width={36} height={36} className="object-cover w-full h-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-800 line-clamp-1">{p.name}</p>
                        <p className="text-[10px] text-gray-400">
                          <span className="font-bold text-gray-900">{CURRENCY_SYMBOL}{p.sellingPrice}</span>
                          {p.price > p.sellingPrice && <span className="line-through ml-1">{CURRENCY_SYMBOL}{p.price}</span>}
                        </p>
                      </div>
                    </Link>
                  ))}
                  <Link
                    href={`/search?q=${encodeURIComponent(query)}`}
                    onClick={() => setOpen(false)}
                    className="block text-center text-xs text-primary font-semibold py-2 border-t border-gray-50 hover:bg-gray-50"
                  >
                    See all results for &ldquo;{query}&rdquo;
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-6">No products found</p>
              )}
            </>
          )}

          {/* Default: Categories */}
          {!query.trim() && categories.length > 0 && (
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase px-3 pt-2 pb-1 flex items-center gap-1">
                <TrendingUp size={10} /> Categories
              </p>
              <div className="grid grid-cols-2 gap-0.5 pb-1">
                {categories.map(cat => (
                  <Link
                    key={cat._id}
                    href={`/categories/${cat._id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition"
                  >
                    {(cat.icon || cat.image) ? (
                      <div className="w-7 h-7 rounded bg-gray-100 overflow-hidden shrink-0">
                        <Image src={imgUrl(cat.icon || cat.image || '')} alt="" width={28} height={28} className="object-cover w-full h-full" />
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs">🏷️</span>
                      </div>
                    )}
                    <span className="text-xs text-gray-700 line-clamp-1">{cat.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
