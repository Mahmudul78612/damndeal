'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { api, imgUrl, CURRENCY_SYMBOL, IS_US } from "@/lib/api";
import { Product, CjVariant } from '@/lib/types';
import { useCart } from '@/context/CartContext';
import ProductReviews from '@/components/ProductReviews';
import ProductSchema from '@/components/ProductSchema';
import { ChevronLeft, Plus, Minus, ShoppingCart, Share2, ChevronRight, X, Star, Truck, RotateCcw, Shield, MapPin } from 'lucide-react';

// Strip all HTML tags → plain text (for previews)
function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

// Basic sanitizer: removes scripts/iframes/event handlers; keeps safe formatting tags & images
function sanitizeHtml(html: string): string {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  // key forces full remount when product ID changes
  return <ProductDetailInner key={id} id={id} />;
}

/* ─── Details Bottom Sheet ─── */
function DetailsSheet({ product, onClose }: { product: Product; onClose: () => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)));
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const close = () => { setOpen(false); setTimeout(onClose, 300); };

  const isCjProd = product.source === 'cj';
  const infoRows = [
    product.brand && { k: 'Brand', v: product.brand },
    product.color && { k: 'Color', v: product.color },
    product.material && { k: 'Material', v: product.material },
    product.weight && { k: 'Weight', v: `${product.weight} ${product.unit || ''}`.trim() },
    product.manufacturer && { k: 'Manufacturer', v: product.manufacturer },
    product.countryOfOrigin && !isCjProd && { k: 'Country of Origin', v: product.countryOfOrigin },
    product.packageContents && { k: 'Package Contents', v: product.packageContents },
    product.warranty && { k: 'Warranty', v: product.warranty },
    product.hsnCode && { k: 'HSN Code', v: product.hsnCode },
  ].filter(Boolean) as { k: string; v: string }[];

  return (
    <div className="fixed inset-0 z-50" onClick={close}>
      <div className={`absolute inset-0 bg-black transition-opacity duration-300 ${open ? 'opacity-40' : 'opacity-0'}`} />
      <div
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] flex flex-col transition-transform duration-300 ease-out ${open ? 'translate-y-0' : 'translate-y-full'}`}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle + Close */}
        <div className="relative flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full absolute left-1/2 -translate-x-1/2 top-1.5" />
          <h3 className="text-base font-bold text-gray-900">Product Details</h3>
          <button onClick={close} className="p-1.5 -mr-1 rounded-full hover:bg-gray-100">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain px-4 pt-4 pb-10 space-y-5">
          {product.description && (
            <section>
              <h4 className="text-sm font-bold text-gray-900 mb-1.5">Description</h4>
              <div
                className="text-[13px] text-gray-600 leading-relaxed prose-product"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description) }}
              />
            </section>
          )}

          {product.highlights && product.highlights.length > 0 && (
            <section>
              <h4 className="text-sm font-bold text-gray-900 mb-1.5">Highlights</h4>
              <ul className="space-y-1">
                {product.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-[13px] text-gray-600">
                    <span className="text-green-500 mt-0.5 shrink-0">✓</span>{h}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {product.specifications && product.specifications.length > 0 && (
            <section>
              <h4 className="text-sm font-bold text-gray-900 mb-1.5">Specifications</h4>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                {product.specifications.map((s, i) => (
                  <div key={i} className={`flex text-[13px] ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <span className="w-2/5 px-3 py-2 text-gray-500 font-medium">{s.key}</span>
                    <span className="w-3/5 px-3 py-2 text-gray-800">{s.value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {infoRows.length > 0 && (
            <section>
              <h4 className="text-sm font-bold text-gray-900 mb-1.5">Product Information</h4>
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                {infoRows.map((r, i) => (
                  <div key={i} className={`flex text-[13px] ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <span className="w-2/5 px-3 py-2 text-gray-500 font-medium">{r.k}</span>
                    <span className="w-3/5 px-3 py-2 text-gray-800">{r.v}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h4 className="text-sm font-bold text-gray-900 mb-1.5">Return & Exchange</h4>
            <div className="bg-gray-50 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <RotateCcw size={15} className={product.isReturnable !== false ? 'text-green-600 shrink-0' : 'text-gray-400 shrink-0'} />
                <span className="text-[13px] font-medium text-gray-800">
                  {product.isReturnable !== false ? `${product.returnPolicy || '7'} Day Easy Returns` : 'Not Returnable'}
                </span>
              </div>
              {product.isCOD !== false && (
                <div className="flex items-center gap-2.5">
                  <Truck size={15} className="text-blue-600 shrink-0" />
                  <span className="text-[13px] font-medium text-gray-800">Cash on Delivery Available</span>
                </div>
              )}
              <div className="flex items-center gap-2.5">
                <Shield size={15} className="text-violet-600 shrink-0" />
                <span className="text-[13px] font-medium text-gray-800">Secure & Safe Payments</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ─── Product Detail ─── */
function ProductDetailInner({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [youMayLikeProducts, setYouMayLikeProducts] = useState<Product[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product[]>([]);
  const [alsoBoughtProducts, setAlsoBoughtProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [zoomPos, setZoomPos] = useState<{ x: number; y: number } | null>(null);
  const mobileScrollerRef = useRef<HTMLDivElement>(null);
  const [selectedVariant, setSelectedVariant] = useState<number>(-1);
  const [selectedCjVariant, setSelectedCjVariant] = useState<number>(-1);
  const [showSheet, setShowSheet] = useState(false);
  const [pincode, setPincode] = useState('');
  const [pincodeResult, setPincodeResult] = useState<{
    serviceable: boolean;
    estimatedDays: number | null;
    estimatedMinDays?: number | null;
    estimatedMaxDays?: number | null;
    cod: boolean;
    city: string;
    state: string;
    deliveryFee?: number;
    deliveryType?: string;
  } | null>(null);
  const [pincodeLoading, setPincodeLoading] = useState(false);
  const { addItem, updateQty, getQty } = useCart();

  const shuffleProducts = (arr: Product[]) => {
    const next = [...arr];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return next;
  };

  useEffect(() => {
    api.get(`/user/products?_id=${id}`)
      .then(res => {
        const products = res.products || [];
        if (products.length > 0) {
          const p = products[0];
          setProduct(p);
          // Auto-select first active variant
          if (p.hasVariants && p.variants?.length) {
            const firstActive = p.variants.findIndex((v: { isActive?: boolean }) => v.isActive !== false);
            setSelectedVariant(firstActive >= 0 ? firstActive : 0);
          }
          // Auto-select first active CJ variant
          if (p.source === 'cj' && p.cjVariants?.length) {
            const firstActive = p.cjVariants.findIndex((v: CjVariant) => v.isActive !== false);
            setSelectedCjVariant(firstActive >= 0 ? firstActive : 0);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Load saved pincode
    const saved = localStorage.getItem('dd_pincode');
    if (saved && /^\d{6}$/.test(saved)) {
      setPincode(saved);
      checkPincode(saved);
    }
  }, [id]);

  useEffect(() => {
    if (!product?._id) return;

    // Track visited category for recommendations
    if (product.category) {
      try {
        const catId = typeof product.category === 'string' ? product.category : (product.category as unknown as { _id?: string })?._id;
        if (catId) {
          const raw = localStorage.getItem('dd_visited_categories');
          const list: string[] = raw ? JSON.parse(raw) : [];
          const filtered = list.filter((c) => c !== catId);
          filtered.unshift(catId);
          localStorage.setItem('dd_visited_categories', JSON.stringify(filtered.slice(0, 8)));
        }
      } catch { /* ignore */ }
    }

    if (product.category) {
      api.get(`/user/products?category=${product.category}&limit=24`)
        .then((res) => {
          const list = (res.products || []).filter((p: Product) => p._id !== product._id);
          setRelatedProducts(shuffleProducts(list).slice(0, 14));
        })
        .catch(() => setRelatedProducts([]));
    } else {
      setRelatedProducts([]);
    }

    api.get('/user/products?limit=40')
      .then((res) => {
        const list = (res.products || []).filter((p: Product) => p._id !== product._id);
        setYouMayLikeProducts(shuffleProducts(list).slice(0, 14));
      })
      .catch(() => setYouMayLikeProducts([]));

    // Recommended for you — from previously visited categories (excluding current), fallback random
    (async () => {
      try {
        const raw = localStorage.getItem('dd_visited_categories');
        const visited: string[] = raw ? JSON.parse(raw) : [];
        const currentCatId = typeof product.category === 'string' ? product.category : (product.category as unknown as { _id?: string })?._id;
        const pool = visited.filter((c) => c && c !== currentCatId).slice(0, 3);
        const collected: Product[] = [];
        for (const cat of pool) {
          try {
            const res = await api.get(`/user/products?category=${cat}&limit=12`);
            const list = (res.products || []).filter((p: Product) => p._id !== product._id);
            collected.push(...list);
          } catch { /* ignore */ }
        }
        // De-duplicate
        const seen = new Set<string>();
        const unique = collected.filter((p) => {
          if (seen.has(p._id)) return false;
          seen.add(p._id);
          return true;
        });
        if (unique.length >= 4) {
          setRecommendedProducts(shuffleProducts(unique).slice(0, 14));
        } else {
          // Fallback: random products
          const res = await api.get('/user/products?limit=40');
          const list = (res.products || []).filter((p: Product) => p._id !== product._id);
          setRecommendedProducts(shuffleProducts([...unique, ...list]).slice(0, 14));
        }
      } catch {
        setRecommendedProducts([]);
      }
    })();

    // Customers also bought — popular products (by salesCount), fallback same-category random
    (async () => {
      try {
        const catQ = product.category ? `&category=${product.category}` : '';
        const res = await api.get(`/user/products?sortBy=popular&limit=24${catQ}`);
        let list = (res.products || []).filter((p: Product) => p._id !== product._id);
        if (list.length < 4 && product.category) {
          const res2 = await api.get(`/user/products?category=${product.category}&limit=24`);
          const list2 = (res2.products || []).filter((p: Product) => p._id !== product._id);
          const seen = new Set(list.map((p: Product) => p._id));
          list = [...list, ...list2.filter((p: Product) => !seen.has(p._id))];
        }
        if (list.length < 4) {
          const res3 = await api.get('/user/products?limit=24');
          const list3 = (res3.products || []).filter((p: Product) => p._id !== product._id);
          const seen = new Set(list.map((p: Product) => p._id));
          list = [...list, ...list3.filter((p: Product) => !seen.has(p._id))];
        }
        setAlsoBoughtProducts(list.slice(0, 14));
      } catch {
        setAlsoBoughtProducts([]);
      }
    })();
  }, [product?._id, product?.category]);

  const checkPincode = async (pin?: string) => {
    const code = pin || pincode;
    if (!/^\d{6}$/.test(code)) return;
    setPincodeLoading(true);
    try {
      const res = await api.get(`/user/check-pincode?pincode=${code}&productId=${id}`);
      setPincodeResult(res);
      localStorage.setItem('dd_pincode', code);
    } catch { setPincodeResult(null); }
    setPincodeLoading(false);
  };



  if (loading) return (
    <div className="animate-pulse px-4 py-4">
      <div className="skeleton h-[42vh] rounded-2xl mb-3" />
      <div className="skeleton h-5 w-3/4 mb-2" />
      <div className="skeleton h-7 w-1/3" />
    </div>
  );

  if (!product) return (
    <div className="text-center py-20">
      <p className="text-gray-400 text-lg">Product not found</p>
      <Link href="/" className="text-primary font-semibold mt-2 inline-block">Go Home</Link>
    </div>
  );

  // CJ products use cjVariants; regular products use variants
  const isCjProduct = product.source === 'cj';
  const activeCjVariant = isCjProduct && product.cjVariants?.length && selectedCjVariant >= 0
    ? product.cjVariants[selectedCjVariant]
    : null;
  const activeVariant = !isCjProduct && product.hasVariants && product.variants?.length && selectedVariant >= 0
    ? product.variants[selectedVariant]
    : null;
  const currentPrice = (activeCjVariant?.sellingPrice ?? activeVariant?.sellingPrice ?? product.sellingPrice) || 0;
  const currentMrp = activeCjVariant?.mrp ?? activeVariant?.mrp ?? product.mrp;
  const currentStock = (activeCjVariant?.stock ?? activeVariant?.stock ?? product.stock) || 0;

  const discount = (currentMrp || 0) > currentPrice
    ? Math.round((((currentMrp || 0) - currentPrice) / (currentMrp || 1)) * 100)
    : 0;
  const images = product.images?.length ? product.images : ['/placeholder.png'];

  // Calculate current price early for schema
  const cartId = product._id + (activeCjVariant ? `_${activeCjVariant.cjVid}` : activeVariant ? `_${activeVariant.label}` : '');
  const qty = getQty(cartId);

  const handleAdd = () => {
    addItem({
      productId: cartId,
      name: product.name + (activeCjVariant ? ` (${activeCjVariant.label})` : activeVariant ? ` (${activeVariant.label})` : ''),
      ...(activeCjVariant && { cjVid: activeCjVariant.cjVid }),
      image: product.images?.[0] || null,
      price: currentPrice,
      mrp: currentMrp,
      unit: product.unit,
      partnerId: product.partner?._id || '',
      partnerName: product.partner?.name || '',
      platform: product.platform || 'damndeal',
      quantity: 1,
      gstPercent: product.gstPercent,
      gstInclusive: product.gstInclusive,
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    const text = `Check out ${product.name} on DamnDeal — ${CURRENCY_SYMBOL}${product.sellingPrice}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, text, url });
      } else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        alert('Link copied to clipboard!');
      }
    } catch {
      /* user dismissed */
    }
  };

  return (
    <div className="pb-28 md:pb-8">
      <ProductSchema
        product={{
          id: product._id,
          name: product.name,
          description: product.description,
          price: currentPrice,
          currency: 'INR',
          image: product.images?.[0],
          brand: product.brand,
          category: typeof product.category === 'string' ? product.category : (product.category as any)?.name,
          inStock: currentStock > 0,
          stock: currentStock,
        }}
      />

      {/* Mobile header */}
      <div className="flex items-center gap-2 px-4 py-2 md:hidden">
        <button onClick={() => window.history.back()} className="p-1 -ml-1 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-sm font-semibold text-gray-900 truncate flex-1">{product.name}</h1>
        <button onClick={handleShare} className="p-1 rounded-lg hover:bg-gray-100">
          <Share2 size={16} />
        </button>
      </div>

      <div className="md:flex md:gap-8 md:px-6 md:py-6 max-w-[1400px] mx-auto">
        {/* Images */}
        <div className="md:w-1/2 md:flex md:items-start md:gap-3">
          {images.length > 1 && (
            <div className="hidden md:flex md:flex-col gap-2 max-h-[540px] overflow-y-auto pr-1 no-scrollbar">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all
                    ${i === activeImg ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <Image src={imgUrl(img)} alt="" width={64} height={64} className="object-cover w-full h-full" />
                </button>
              ))}
            </div>
          )}

          <div className="flex-1">
            {/* Mobile: swipeable scroll-snap carousel */}
            <div className="md:hidden">
              <div
                ref={mobileScrollerRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const w = el.clientWidth;
                  if (w <= 0) return;
                  const idx = Math.round(el.scrollLeft / w);
                  if (idx !== activeImg && idx >= 0 && idx < images.length) setActiveImg(idx);
                }}
                className="relative flex overflow-x-auto snap-x snap-mandatory no-scrollbar h-[42vh] bg-white rounded-2xl mx-4"
                style={{ scrollBehavior: 'smooth' }}
              >
                {images.map((img, i) => (
                  <div key={i} className="relative w-full shrink-0 snap-center flex items-center justify-center">
                    <Image
                      src={imgUrl(img)}
                      alt={`${product.name} - ${i + 1}`}
                      fill
                      className="object-contain p-4"
                      sizes="100vw"
                      priority={i === 0}
                      draggable={false}
                    />
                  </div>
                ))}
                {discount > 0 && (
                  <span className="pointer-events-none absolute top-3 left-7 z-10 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    {discount}% OFF
                  </span>
                )}
                {isCjProduct && (
                  <span className="pointer-events-none absolute bottom-3 right-7 z-10 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow flex items-center gap-1">
                    ✈ International
                  </span>
                )}
                {/* Page indicator dots */}
                {images.length > 1 && (
                  <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    {images.map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${i === activeImg ? 'w-4 bg-primary' : 'w-1.5 bg-gray-300'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-2 mt-2 px-4 justify-center overflow-x-auto no-scrollbar">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setActiveImg(i);
                        const el = mobileScrollerRef.current;
                        if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
                      }}
                      className={`shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all
                        ${i === activeImg ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'}`}
                    >
                      <Image src={imgUrl(img)} alt="" width={64} height={64} className="object-cover w-full h-full" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Desktop: hover-lens zoom (Amazon/Flipkart style) */}
            <div
              onMouseEnter={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                setZoomPos({
                  x: ((e.clientX - r.left) / r.width) * 100,
                  y: ((e.clientY - r.top) / r.height) * 100,
                });
              }}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                const x = ((e.clientX - r.left) / r.width) * 100;
                const y = ((e.clientY - r.top) / r.height) * 100;
                setZoomPos({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
              }}
              onMouseLeave={() => setZoomPos(null)}
              className="hidden md:block relative aspect-square bg-white rounded-2xl overflow-visible group cursor-zoom-in"
            >
              <div className="absolute inset-0 overflow-hidden rounded-2xl">
                <Image
                  src={imgUrl(images[activeImg])}
                  alt={product.name}
                  fill
                  className="object-contain p-4 select-none"
                  sizes="50vw"
                  priority
                  draggable={false}
                />
              </div>
              {discount > 0 && (
                <span className="absolute top-3 left-3 z-10 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                  {discount}% OFF
                </span>
              )}
              {isCjProduct && (
                <span className="absolute bottom-3 right-3 z-10 bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow flex items-center gap-1">
                  ✈ International
                </span>
              )}
              {/* Lens circle following cursor */}
              {zoomPos && (
                <div
                  className="pointer-events-none absolute rounded-full border-2 border-primary/70 bg-white/30 backdrop-blur-[1px] shadow-md"
                  style={{
                    width: 140,
                    height: 140,
                    left: `calc(${zoomPos.x}% - 70px)`,
                    top: `calc(${zoomPos.y}% - 70px)`,
                    zIndex: 20,
                  }}
                />
              )}
              {/* Side zoom panel */}
              {zoomPos && (
                <div
                  className="pointer-events-none hidden lg:block absolute top-0 left-[calc(100%+16px)] w-[480px] h-[480px] rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden z-30"
                  style={{
                    backgroundImage: `url(${imgUrl(images[activeImg])})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '250%',
                    backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="md:w-1/2 px-4 md:px-0 mt-3 md:mt-0">
          <div className="hidden md:flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold text-gray-900 flex-1">{product.name}</h1>
            <button
              onClick={handleShare}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold transition"
              title="Share product"
            >
              <Share2 size={14} /> Share
            </button>
          </div>
          {product.brand && <p className="text-xs text-gray-400">{product.brand}</p>}
          {(product.weight || (product.unit && product.unit !== 'piece')) && (
            <p className="text-xs text-gray-500">{product.weight ? `${product.weight} ` : ''}{product.unit}</p>
          )}

          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="text-2xl md:text-3xl font-extrabold text-gray-900">{CURRENCY_SYMBOL}{currentPrice}</span>
            {discount > 0 && (
              <>
                <span className="text-sm text-gray-400 line-through">{CURRENCY_SYMBOL}{currentMrp}</span>
                <span className="text-xs font-bold text-green-600">{discount}% off</span>
              </>
            )}
          </div>

          {product.rating && product.rating > 0 ? (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex items-center gap-0.5 bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                {product.rating.toFixed(1)} <Star size={9} fill="white" />
              </div>
              {product.reviewCount && product.reviewCount > 0 && (
                <span className="text-[10px] text-gray-400">{product.reviewCount} reviews</span>
              )}
            </div>
          ) : null}

          <p className={`text-xs font-medium mt-1 ${currentStock > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {currentStock > 0 ? `In Stock${currentStock <= 5 ? ` (Only ${currentStock} left)` : ''}` : 'Out of Stock'}
          </p>

          {/* Variants — CJ products use cjVariants; regular products use variants */}
          {isCjProduct && product.cjVariants && product.cjVariants.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs font-bold text-gray-900 mb-1.5">Options</h3>
              <div className="flex flex-wrap gap-1.5">
                {product.cjVariants.map((v, i) => {
                  const isActive = v.isActive !== false;
                  const isSelected = selectedCjVariant === i;
                  return (
                    <button
                      key={i}
                      disabled={!isActive || v.stock <= 0}
                      onClick={() => setSelectedCjVariant(i)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all
                        ${isSelected
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : isActive && v.stock > 0
                            ? 'border-gray-200 bg-white text-gray-800 hover:border-gray-400'
                            : 'border-gray-100 bg-gray-50 text-gray-300 line-through cursor-not-allowed'
                        }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {!isCjProduct && product.hasVariants && product.variants && product.variants.length > 0 && (
            <div className="mt-3">
              <h3 className="text-xs font-bold text-gray-900 mb-1.5">Size</h3>
              <div className="flex flex-wrap gap-1.5">
                {product.variants.map((v, i) => {
                  const isActive = v.isActive !== false;
                  const isSelected = selectedVariant === i;
                  return (
                    <button
                      key={i}
                      disabled={!isActive || v.stock <= 0}
                      onClick={() => setSelectedVariant(i)}
                      className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all
                        ${isSelected
                          ? 'border-gray-900 bg-gray-900 text-white'
                          : isActive && v.stock > 0
                            ? 'border-gray-200 bg-white text-gray-800 hover:border-gray-400'
                            : 'border-gray-100 bg-gray-50 text-gray-300 line-through cursor-not-allowed'
                        }`}
                    >
                      {v.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick info pills */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {product.isReturnable !== false && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded-md font-medium">
                <RotateCcw size={11} className="text-green-600" /> {product.returnPolicy || '7'} Day Return
              </span>
            )}
            {product.isCOD !== false && !IS_US && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded-md font-medium">
                <Truck size={11} className="text-blue-600" /> COD
              </span>
            )}
            {product.countryOfOrigin && !isCjProduct && !IS_US && (
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 bg-gray-50 px-2 py-1 rounded-md font-medium">
                🇮🇳 {product.countryOfOrigin}
              </span>
            )}
          </div>

          {/* Delivery Check — India pincode serviceability. Hidden on US
              (CJ ships everywhere; no pincode/COD concept there). */}
          {IS_US ? (
            <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <Truck size={14} className="text-green-600" /> Free shipping · Ships in 7–15 days
            </div>
          ) : (
          <div className="mt-3 bg-gray-50 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-gray-400 shrink-0" />
              <input
                type="text"
                value={pincode}
                onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setPincode(v); if (v.length < 6) setPincodeResult(null); }}
                placeholder="Enter pincode"
                maxLength={6}
                className="flex-1 bg-transparent text-sm outline-none text-gray-800 placeholder:text-gray-400"
                onKeyDown={e => e.key === 'Enter' && checkPincode()}
              />
              <button
                onClick={() => checkPincode()}
                disabled={pincode.length !== 6 || pincodeLoading}
                className="text-xs font-bold text-primary disabled:text-gray-300"
              >
                {pincodeLoading ? '...' : 'Check'}
              </button>
            </div>
            {pincodeResult && (
              <div className="mt-2 pt-2 border-t border-gray-200/60">
                {pincodeResult.serviceable ? (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Truck size={13} className="text-green-600" />
                      <span className="text-xs font-semibold text-green-700">
                        {(isCjProduct || pincodeResult.deliveryType === 'international')
                          ? `International delivery in ${pincodeResult.estimatedMinDays || pincodeResult.estimatedDays || 10}-${pincodeResult.estimatedMaxDays || pincodeResult.estimatedDays || 20} days`
                          : `Delivery in ${pincodeResult.estimatedDays} ${pincodeResult.estimatedDays === 1 ? 'day' : 'days'}`}
                      </span>
                    </div>
                    {pincodeResult.city && (
                      <p className="text-[10px] text-gray-400 ml-5">{pincodeResult.city}{pincodeResult.state ? `, ${pincodeResult.state}` : ''}</p>
                    )}
                    {pincodeResult.deliveryFee && pincodeResult.deliveryFee > 0 && !isCjProduct && (
                      <p className="text-[10px] text-gray-500 ml-5">Estimated delivery fee: {CURRENCY_SYMBOL}{Math.round(pincodeResult.deliveryFee)}</p>
                    )}
                    {pincodeResult.cod && (
                      <p className="text-[10px] text-gray-500 ml-5">✓ Cash on Delivery available</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-red-500 font-medium">Sorry, delivery not available to this pincode</p>
                )}
              </div>
            )}
          </div>
          )}

          {/* Description preview */}
          {product.description && (
            <p className="text-xs text-gray-500 leading-relaxed mt-2.5 line-clamp-2">{stripHtml(product.description)}</p>
          )}

          {/* View All Details */}
          <button
            onClick={() => setShowSheet(true)}
            className="mt-2 flex items-center gap-0.5 text-xs font-semibold text-violet-600 hover:underline"
          >
            View All Details <ChevronRight size={14} />
          </button>

          {/* Desktop Add to Cart */}
          <div className="hidden md:block mt-5">
            {currentStock > 0 && (
              qty > 0 ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-gray-900 rounded-xl overflow-hidden">
                    <button onClick={() => updateQty(cartId, qty - 1)} className="p-3 text-white hover:bg-gray-700">
                      <Minus size={18} />
                    </button>
                    <span className="text-white text-lg font-bold w-8 text-center">{qty}</span>
                    <button onClick={() => updateQty(cartId, qty + 1)} className="p-3 text-white hover:bg-gray-700">
                      <Plus size={18} />
                    </button>
                  </div>
                  <Link href="/cart" className="flex-1 flex items-center justify-center gap-2 py-3 bg-gray-100 text-gray-900 rounded-xl font-semibold hover:bg-gray-200 transition">
                    <ShoppingCart size={18} />
                    Go to Cart
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleAdd}
                  className="w-full py-3.5 bg-gray-900 text-white rounded-xl font-bold text-base hover:bg-gray-800 transition flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={20} />
                  Add to Cart
                </button>
              )
            )}
          </div>

        </div>
      </div>

      {/* Related / You may like */}
      <div className="px-4 md:px-6 max-w-[1400px] mx-auto mt-6 space-y-6">
        <ProductReviews productId={product._id} />
        {relatedProducts.length > 0 && (
          <section>
            <h3 className="text-lg font-bold text-gray-900 mb-3">Related Products</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {relatedProducts.map((rp) => (
                <Link key={rp._id} href={`/product/${rp._id}`} className="shrink-0 w-40 md:w-44 bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="relative h-36 md:h-40 bg-gray-50">
                    <Image src={imgUrl(rp.images?.[0])} alt={rp.name} fill className="object-contain p-2" sizes="176px" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs text-gray-800 line-clamp-2 min-h-[2rem]">{rp.name}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{CURRENCY_SYMBOL}{rp.sellingPrice}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {youMayLikeProducts.length > 0 && (
          <section>
            <h3 className="text-lg font-bold text-gray-900 mb-3">You may like</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {youMayLikeProducts.map((yp) => (
                <Link key={yp._id} href={`/product/${yp._id}`} className="shrink-0 w-40 md:w-44 bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="relative h-36 md:h-40 bg-gray-50">
                    <Image src={imgUrl(yp.images?.[0])} alt={yp.name} fill className="object-contain p-2" sizes="176px" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs text-gray-800 line-clamp-2 min-h-[2rem]">{yp.name}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{CURRENCY_SYMBOL}{yp.sellingPrice}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {recommendedProducts.length > 0 && (
          <section className="bg-violet-50 -mx-4 md:-mx-6 px-4 md:px-6 py-4 rounded-none md:rounded-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Recommended for you</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {recommendedProducts.map((rp) => (
                <Link key={rp._id} href={`/product/${rp._id}`} className="shrink-0 w-40 md:w-44 bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="relative h-36 md:h-40 bg-gray-50">
                    <Image src={imgUrl(rp.images?.[0])} alt={rp.name} fill className="object-contain p-2" sizes="176px" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs text-gray-800 line-clamp-2 min-h-[2rem]">{rp.name}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{CURRENCY_SYMBOL}{rp.sellingPrice}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {alsoBoughtProducts.length > 0 && (
          <section className="bg-amber-50 -mx-4 md:-mx-6 px-4 md:px-6 py-4 rounded-none md:rounded-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Customers also bought</h3>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {alsoBoughtProducts.map((ap) => (
                <Link key={ap._id} href={`/product/${ap._id}`} className="shrink-0 w-40 md:w-44 bg-white border border-gray-100 rounded-xl overflow-hidden">
                  <div className="relative h-36 md:h-40 bg-gray-50">
                    <Image src={imgUrl(ap.images?.[0])} alt={ap.name} fill className="object-contain p-2" sizes="176px" />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs text-gray-800 line-clamp-2 min-h-[2rem]">{ap.name}</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{CURRENCY_SYMBOL}{ap.sellingPrice}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Mobile sticky bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 md:hidden z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] safe-bottom">
        {currentStock > 0 ? (
          qty > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-gray-900 rounded-xl overflow-hidden">
                <button onClick={() => updateQty(cartId, qty - 1)} className="p-2 text-white"><Minus size={16} /></button>
                <span className="text-white font-bold w-6 text-center">{qty}</span>
                <button onClick={() => updateQty(cartId, qty + 1)} className="p-2 text-white"><Plus size={16} /></button>
              </div>
              <Link href="/cart" className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-center text-sm">
                Go to Cart — {CURRENCY_SYMBOL}{(currentPrice * qty).toFixed(0)}
              </Link>
            </div>
          ) : (
            <button onClick={handleAdd} className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
              <ShoppingCart size={18} /> Add to Cart — {CURRENCY_SYMBOL}{currentPrice}
            </button>
          )
        ) : (
          <p className="text-center text-red-500 font-semibold text-sm">Out of Stock</p>
        )}
      </div>

      {/* Details Bottom Sheet */}
      {showSheet && <DetailsSheet product={product} onClose={() => setShowSheet(false)} />}
    </div>
  );
}
