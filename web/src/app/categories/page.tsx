'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { api, imgUrl } from '@/lib/api';
import { Category, Product } from '@/lib/types';
import ProductCard from '@/components/ProductCard';
import { ChevronRight } from 'lucide-react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsByCat, setProductsByCat] = useState<Record<string, Product[]>>({});

  useEffect(() => {
    api.get('/categories?platform=damndeal')
      .then(res => {
        const cats: Category[] = res.categories || [];
        setCategories(cats);
        cats.forEach(cat => {
          api.get(`/user/products?category=${cat._id}&limit=12&platform=damndeal`)
            .then(r => {
              setProductsByCat(prev => ({ ...prev, [cat._id]: r.products || [] }));
            })
            .catch(() => {});
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 py-4 md:px-6 max-w-[1400px] mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-4 md:text-2xl">Categories</h1>

      {loading ? (
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="skeleton aspect-square rounded-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 md:gap-4">
          {categories.map(cat => (
            <Link
              key={cat._id}
              href={`/categories/${cat._id}`}
              className="group flex flex-col items-center gap-1.5"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden bg-gray-50 flex items-center justify-center">
                {(cat.image || cat.icon) ? (
                  <Image src={imgUrl(cat.image || cat.icon || '')} alt={cat.name} width={80} height={80} className="object-cover w-full h-full group-hover:scale-110 transition-transform" />
                ) : (
                  <span className="text-2xl">🏷️</span>
                )}
              </div>
              <span className="text-[11px] md:text-xs font-medium text-gray-700 text-center line-clamp-2 leading-tight">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 space-y-8">
        {categories.map(cat => {
          const products = productsByCat[cat._id] || [];
          if (products.length === 0) return null;
          return (
            <section key={cat._id}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base md:text-lg font-bold text-gray-900">{cat.name}</h2>
                <Link
                  href={`/categories/${cat._id}`}
                  className="text-xs md:text-sm font-semibold text-primary flex items-center gap-0.5 hover:underline"
                >
                  View all <ChevronRight size={14} />
                </Link>
              </div>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 md:mx-0 md:px-0">
                {products.map(p => (
                  <div key={p._id} className="shrink-0 w-36 md:w-44">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
