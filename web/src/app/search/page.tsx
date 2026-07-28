'use client';

import { useEffect, useState, useRef } from 'react';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, imgUrl, CURRENCY_SYMBOL } from "@/lib/api";
import { Product } from '@/lib/types';
import Image from 'next/image';
import { Search as SearchIcon, X, Plus, Minus } from 'lucide-react';
import { useCart } from '@/context/CartContext';

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);
  const { addItem, updateQty, getQty } = useCart();

  const queryFromUrl = (searchParams.get('q') || '').trim();

  useEffect(() => {
    if (!queryFromUrl) inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (queryFromUrl && queryFromUrl !== query) {
      setQuery(queryFromUrl);
    }
  }, [queryFromUrl]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setProducts([]); return; }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      api.get(`/user/search?q=${encodeURIComponent(query)}&limit=40`)
        .then(res => setProducts(res.products || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const openProduct = (productId: string) => router.push(`/product/${productId}`);

  const handleAddToCart = (prod: Product) => {
    addItem({
      productId: prod._id,
      name: prod.name,
      image: prod.images?.[0] || null,
      price: prod.sellingPrice,
      mrp: prod.mrp,
      unit: prod.unit,
      partnerId: prod.partner?._id || '',
      partnerName: prod.partner?.name || '',
      platform: prod.platform || 'damndeal',
      quantity: 1,
      gstPercent: prod.gstPercent,
      gstInclusive: prod.gstInclusive,
    });
  };

  const renderProductCard = (p: Product) => {
    const qty = getQty(p._id);
    const discount = (p.mrp || p.price) > p.sellingPrice
      ? Math.round((((p.mrp || p.price) - p.sellingPrice) / (p.mrp || p.price)) * 100)
      : 0;

    return (
      <div
        key={p._id}
        onClick={() => openProduct(p._id)}
        className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all text-left group w-full"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openProduct(p._id);
          }
        }}
      >
        <div className="relative aspect-square overflow-hidden bg-gray-50">
          <Image
            src={imgUrl(p.images?.[0])}
            alt={p.name}
            fill
            className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, 20vw"
          />
          {discount > 0 && (
            <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
              {discount}% OFF
            </span>
          )}
          {p.source === 'cj' && (
            <span className="absolute bottom-1.5 right-1.5 bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow">
              ✈ International
            </span>
          )}
          {p.stock <= 0 && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white font-bold text-xs bg-black/60 px-2 py-0.5 rounded">Out of Stock</span>
            </div>
          )}
        </div>

        <div className="p-2">
          <h3 className="text-xs font-medium text-gray-800 line-clamp-2 leading-tight min-h-[2rem]">
            {p.name}
          </h3>
          {p.unit && (
            <p className="text-[10px] text-gray-400 mt-0.5">{p.weight ? `${p.weight} ` : ''}{p.unit}</p>
          )}
          <div className="flex items-center justify-between mt-1.5">
            <div>
              <span className="text-sm font-bold text-gray-900">{CURRENCY_SYMBOL}{p.sellingPrice}</span>
              {discount > 0 && (
                <span className="text-[10px] text-gray-400 line-through ml-1">{CURRENCY_SYMBOL}{p.mrp || p.price}</span>
              )}
            </div>
            {p.stock > 0 && (
              qty > 0 ? (
                <div className="flex items-center gap-0.5 bg-primary rounded-md overflow-hidden">
                  <button onClick={(e) => { e.stopPropagation(); updateQty(p._id, qty - 1); }} className="p-1 text-white hover:bg-primary-dark">
                    <Minus size={12} />
                  </button>
                  <span className="text-white text-xs font-bold w-4 text-center">{qty}</span>
                  <button onClick={(e) => { e.stopPropagation(); updateQty(p._id, qty + 1); }} className="p-1 text-white hover:bg-primary-dark">
                    <Plus size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); handleAddToCart(p); }}
                  className="bg-primary/10 text-primary text-[11px] font-bold px-2.5 py-1 rounded-md hover:bg-primary/20 transition"
                >
                  ADD
                </button>
              )
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-4 md:px-6 max-w-7xl mx-auto">
        {/* Search input */}
        <div className="relative mb-4 md:hidden">
          <SearchIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                setQuery(e.currentTarget.value.trim());
              }
            }}
            placeholder="Search for products..."
            className="w-full pl-10 pr-10 py-3 bg-white rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton h-64 rounded-2xl" />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map(p => renderProductCard(p))}
          </div>
        ) : query.trim() ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No products found for &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <div className="text-center py-20">
            <SearchIcon size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-400">Search for products, brands, and more</p>
          </div>
        )}
      </div>

    </div>
  );
}
