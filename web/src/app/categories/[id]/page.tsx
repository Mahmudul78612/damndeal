'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Product } from '@/lib/types';
import ProductCard from '@/components/ProductCard';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { imgUrl } from '@/lib/api';

const ALL_SUB_ID = '__all__';

const PRICE_RANGES = [
  { key: 'under-199', label: 'Under 199' },
  { key: '200-499', label: '200-499' },
  { key: '500-999', label: '500-999' },
  { key: '1000+', label: '1000+' },
];

function priceMatch(price: number, range: string) {
  if (range === 'under-199') return price < 199;
  if (range === '200-499') return price >= 200 && price <= 499;
  if (range === '500-999') return price >= 500 && price <= 999;
  if (range === '1000+') return price >= 1000;
  return true;
}

export default function CategoryProductsPage() {
  const { id } = useParams<{ id: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [selectedSub, setSelectedSub] = useState<string>(ALL_SUB_ID);
  const [selectedPrice, setSelectedPrice] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [minPriceInput, setMinPriceInput] = useState<string>('');
  const [maxPriceInput, setMaxPriceInput] = useState<string>('');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minDiscount, setMinDiscount] = useState<number>(0);
  const [minRating, setMinRating] = useState<number>(0);
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('relevance');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showAllMobile, setShowAllMobile] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [catName, setCatName] = useState('');

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    api.get(`/subcategories?category=${id}`)
      .then(res => {
        const list = res.subCategories || [];
        setSubCategories([{ _id: ALL_SUB_ID, name: 'All' }, ...list]);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    setShowAllMobile(false);
    const sub = selectedSub && selectedSub !== ALL_SUB_ID ? `&subCategory=${selectedSub}` : '';
    api.get(`/user/products?category=${id}${sub}&page=1&limit=20`)
      .then(res => {
        setProducts(res.products || []);
        setHasMore((res.products || []).length >= 20);
        if (res.products?.[0]?.categoryName) setCatName(res.products[0].categoryName);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, selectedSub]);

  const loadMore = () => {
    const nextPage = page + 1;
    const sub = selectedSub && selectedSub !== ALL_SUB_ID ? `&subCategory=${selectedSub}` : '';
    api.get(`/user/products?category=${id}${sub}&page=${nextPage}&limit=20`)
      .then(res => {
        setProducts(prev => [...prev, ...(res.products || [])]);
        setHasMore((res.products || []).length >= 20);
        setPage(nextPage);
      });
  };

  const sizeOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.size) set.add(String(p.size));
      p.variants?.forEach((v) => {
        if (v.label && v.label.length <= 14) set.add(v.label);
      });
    });
    return Array.from(set).slice(0, 10);
  }, [products]);

  const priceBounds = useMemo(() => {
    if (!products.length) return { min: 0, max: 5000 };
    const prices = products.map((p) => p.sellingPrice || 0);
    return {
      min: Math.max(0, Math.floor(Math.min(...prices))),
      max: Math.max(1, Math.ceil(Math.max(...prices))),
    };
  }, [products]);

  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.brand) set.add(String(p.brand));
    });
    return Array.from(set).slice(0, 10);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const minCustom = minPriceInput ? Number(minPriceInput) : null;
    const maxCustom = maxPriceInput ? Number(maxPriceInput) : null;

    return products.filter((p) => {
      const priceOk = selectedPrice ? priceMatch(p.sellingPrice, selectedPrice) : true;
      const customPriceOk = (
        (minCustom === null || p.sellingPrice >= minCustom) &&
        (maxCustom === null || p.sellingPrice <= maxCustom)
      );
      const sizeOk = selectedSize
        ? (
          (p.size && String(p.size).toLowerCase() === selectedSize.toLowerCase()) ||
          (p.variants || []).some((v) => String(v.label || '').toLowerCase() === selectedSize.toLowerCase())
        )
        : true;
      const stockOk = inStockOnly ? p.stock > 0 : true;
      const discountPercent = (p.mrp || p.price || p.sellingPrice) > p.sellingPrice
        ? Math.round((((p.mrp || p.price || p.sellingPrice) - p.sellingPrice) / (p.mrp || p.price || p.sellingPrice)) * 100)
        : 0;
      const discountOk = minDiscount > 0 ? discountPercent >= minDiscount : true;
      const ratingOk = minRating > 0 ? (p.rating || 0) >= minRating : true;
      const brandOk = selectedBrand ? String(p.brand || '').toLowerCase() === selectedBrand.toLowerCase() : true;
      return priceOk && customPriceOk && sizeOk && stockOk && discountOk && ratingOk && brandOk;
    });
  }, [products, selectedPrice, selectedSize, minPriceInput, maxPriceInput, inStockOnly, minDiscount, minRating, selectedBrand]);

  const sortedProducts = useMemo(() => {
    const arr = [...filteredProducts];
    if (sortBy === 'price-low-high') arr.sort((a, b) => a.sellingPrice - b.sellingPrice);
    if (sortBy === 'price-high-low') arr.sort((a, b) => b.sellingPrice - a.sellingPrice);
    if (sortBy === 'discount-high-low') {
      arr.sort((a, b) => {
        const ad = (a.mrp || a.price || a.sellingPrice) - a.sellingPrice;
        const bd = (b.mrp || b.price || b.sellingPrice) - b.sellingPrice;
        return bd - ad;
      });
    }
    return arr;
  }, [filteredProducts, sortBy]);

  const visibleProducts = isMobile && !showAllMobile ? sortedProducts.slice(0, 6) : sortedProducts;
  const canShowViewAll = isMobile && sortedProducts.length > 6 && !showAllMobile;

  return (
    <div className="px-2 py-3 md:px-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3 px-2 md:px-0">
        <Link href="/categories" className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{catName || 'Products'}</h1>
      </div>

      {/* Horizontal SubCategory Scroll - Desktop Only */}
      <div className="hidden md:block mb-4 overflow-x-auto">
        <div className="flex gap-2 md:gap-3 pb-2">
          {subCategories.map((sub) => {
            const active = selectedSub === sub._id;
            const image = sub.image || sub.icon;
            return (
              <button
                key={sub._id}
                onClick={() => setSelectedSub(sub._id)}
                className={`flex flex-col items-center gap-1.5 rounded-lg p-2 md:p-2.5 transition shrink-0 ${active ? 'bg-primary/10 border border-primary/30' : 'border border-gray-100 hover:bg-gray-50'}`}
              >
                <div className="relative w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                  {image ? (
                    <Image src={imgUrl(image)} alt={sub.name || 'Sub'} fill className="object-cover" sizes="64px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-gray-500">
                      {(sub.name || 'A').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className={`text-xs leading-tight line-clamp-1 max-w-16 md:max-w-20 ${active ? 'font-semibold text-primary' : 'text-gray-700'}`}>
                  {sub.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 md:gap-0 items-start">
        {/* Mobile Left Sidebar - SubCategories */}
        {subCategories.length > 1 && (
          <aside className="md:hidden w-20 shrink-0 sticky top-2 max-h-[calc(100vh-100px)] overflow-y-auto no-scrollbar">
            <div className="flex flex-col gap-1.5 pb-2">
              {subCategories.map((sub) => {
                const active = selectedSub === sub._id;
                const image = sub.image || sub.icon;
                return (
                  <button
                    key={sub._id}
                    onClick={() => setSelectedSub(sub._id)}
                    className={`flex flex-col items-center gap-1 rounded-lg p-1.5 transition ${active ? 'bg-primary/10 border border-primary/30' : 'border border-transparent hover:bg-gray-100'}`}
                  >
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 shrink-0 border border-gray-200">
                      {image ? (
                        <Image src={imgUrl(image)} alt={sub.name || 'Sub'} fill className="object-cover" sizes="48px" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-gray-500">
                          {(sub.name || 'A').slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <span className={`text-[9px] leading-tight line-clamp-2 text-center ${active ? 'font-semibold text-primary' : 'text-gray-700'}`}>
                      {sub.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>
        )}

        {/* Desktop Sidebar Filters - hidden on mobile */}
        <aside className="hidden md:block w-56 shrink-0 rounded-xl border border-gray-200 bg-white p-3 sticky top-20 max-h-[calc(100vh-120px)] overflow-y-auto">
          <div className="space-y-3">
            <div>
              <p className="text-[10px] md:text-xs font-semibold text-gray-500 px-1 mb-1.5">Price</p>
              <div className="space-y-1">
                {PRICE_RANGES.map((r) => (
                  <button
                    key={r.key}
                    onClick={() => setSelectedPrice((prev) => (prev === r.key ? '' : r.key))}
                    className={`w-full text-left px-2 py-1 rounded-md text-[10px] md:text-xs transition ${selectedPrice === r.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 rounded-lg border border-gray-200 p-2">
                <p className="text-[10px] font-semibold text-gray-500 mb-1">Custom Range</p>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    value={minPriceInput}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    placeholder="Min"
                    className="w-full h-7 rounded-md border border-gray-200 px-2 text-[10px]"
                  />
                  <span className="text-[10px] text-gray-400">-</span>
                  <input
                    type="number"
                    min={0}
                    value={maxPriceInput}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    placeholder="Max"
                    className="w-full h-7 rounded-md border border-gray-200 px-2 text-[10px]"
                  />
                </div>
                <div className="mt-2 space-y-1">
                  <input
                    type="range"
                    min={priceBounds.min}
                    max={priceBounds.max}
                    value={minPriceInput || priceBounds.min}
                    onChange={(e) => setMinPriceInput(e.target.value)}
                    className="w-full"
                  />
                  <input
                    type="range"
                    min={priceBounds.min}
                    max={priceBounds.max}
                    value={maxPriceInput || priceBounds.max}
                    onChange={(e) => setMaxPriceInput(e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>

            {sizeOptions.length > 0 && (
              <div className="pt-3 border-t border-gray-100">
                <p className="text-[10px] md:text-xs font-semibold text-gray-500 px-1 mb-1.5">Size</p>
                <div className="flex flex-wrap gap-1">
                  {sizeOptions.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize((prev) => (prev === size ? '' : size))}
                      className={`px-2 py-1 rounded-md text-[10px] md:text-xs transition ${selectedSize === size ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-gray-100">
              <p className="text-[10px] md:text-xs font-semibold text-gray-500 px-1 mb-1.5">More Filters</p>
              <div className="space-y-2 px-1">
                <label className="flex items-center gap-2 text-[11px] text-gray-700">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                  />
                  In stock only
                </label>

                <div>
                  <p className="text-[10px] text-gray-500 mb-1">Discount</p>
                  <select
                    value={minDiscount}
                    onChange={(e) => setMinDiscount(Number(e.target.value))}
                    className="w-full h-7 rounded-md border border-gray-200 px-2 text-[10px]"
                  >
                    <option value={0}>Any</option>
                    <option value={10}>10% or more</option>
                    <option value={20}>20% or more</option>
                    <option value={30}>30% or more</option>
                    <option value={40}>40% or more</option>
                  </select>
                </div>

                <div>
                  <p className="text-[10px] text-gray-500 mb-1">Rating</p>
                  <select
                    value={minRating}
                    onChange={(e) => setMinRating(Number(e.target.value))}
                    className="w-full h-7 rounded-md border border-gray-200 px-2 text-[10px]"
                  >
                    <option value={0}>Any</option>
                    <option value={4}>4★ & above</option>
                    <option value={3}>3★ & above</option>
                  </select>
                </div>

                {brandOptions.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1">Brand</p>
                    <select
                      value={selectedBrand}
                      onChange={(e) => setSelectedBrand(e.target.value)}
                      className="w-full h-7 rounded-md border border-gray-200 px-2 text-[10px]"
                    >
                      <option value="">All Brands</option>
                      {brandOptions.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        <section className="flex-1 min-w-0 pb-16 md:pb-0 md:ml-4">
          <div className="md:hidden mb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMobileFilters((prev) => !prev)}
                className="h-8 px-3 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-700"
              >
                Filters
              </button>
              <div className="h-8 px-2 rounded-lg border border-gray-200 bg-white flex items-center">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="text-xs font-semibold text-gray-700 bg-transparent outline-none"
                >
                  <option value="relevance">Sort</option>
                  <option value="price-low-high">Price: Low to High</option>
                  <option value="price-high-low">Price: High to Low</option>
                  <option value="discount-high-low">Discount</option>
                </select>
              </div>
              {(selectedPrice || selectedSize || minPriceInput || maxPriceInput || inStockOnly || minDiscount > 0 || minRating > 0 || selectedBrand) && (
                <button
                  onClick={() => {
                    setSelectedPrice('');
                    setSelectedSize('');
                    setMinPriceInput('');
                    setMaxPriceInput('');
                    setInStockOnly(false);
                    setMinDiscount(0);
                    setMinRating(0);
                    setSelectedBrand('');
                  }}
                  className="text-[11px] font-semibold text-primary"
                >
                  Clear
                </button>
              )}
            </div>
            {showMobileFilters && (
              <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2">
                <p className="text-[11px] font-semibold text-gray-500 mb-1">Price</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRICE_RANGES.map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setSelectedPrice((prev) => (prev === r.key ? '' : r.key))}
                      className={`px-2 py-1 rounded-md text-[10px] ${selectedPrice === r.key ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {sizeOptions.length > 0 && (
                  <>
                    <p className="text-[11px] font-semibold text-gray-500 mt-2 mb-1">Size</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sizeOptions.map((size) => (
                        <button
                          key={size}
                          onClick={() => setSelectedSize((prev) => (prev === size ? '' : size))}
                          className={`px-2 py-1 rounded-md text-[10px] ${selectedSize === size ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-1 mb-2">
            <p className="text-xs text-gray-500">{sortedProducts.length} products</p>
            {(selectedPrice || selectedSize || minPriceInput || maxPriceInput || inStockOnly || minDiscount > 0 || minRating > 0 || selectedBrand) && (
              <button
                onClick={() => {
                  setSelectedPrice('');
                  setSelectedSize('');
                  setMinPriceInput('');
                  setMaxPriceInput('');
                  setInStockOnly(false);
                  setMinDiscount(0);
                  setMinRating(0);
                  setSelectedBrand('');
                }}
                className="text-[11px] font-semibold text-primary"
              >
                Clear Filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton h-52 rounded-2xl" />
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-400 text-lg">No products found</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                {visibleProducts.map((p) => <ProductCard key={p._id} product={p} />)}
              </div>

              {canShowViewAll && (
                <button
                  onClick={() => setShowAllMobile(true)}
                  className="w-full mt-3 h-8 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-700"
                >
                  View All
                </button>
              )}

              {hasMore && (!isMobile || showAllMobile) && (
                <button onClick={loadMore} className="mx-auto mt-6 block px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-dark transition">
                  Load More
                </button>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
