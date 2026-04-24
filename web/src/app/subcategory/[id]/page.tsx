'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Product } from '@/lib/types';
import ProductCard from '@/components/ProductCard';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';

export default function SubCategoryProductsPage() {
  const { id } = useParams<{ id: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [subCatName, setSubCatName] = useState('');

  useEffect(() => {
    setLoading(true);
    setPage(1);
    api.get(`/user/products?subCategory=${id}&page=1&limit=20`)
      .then(res => {
        setProducts(res.products || []);
        setHasMore((res.products || []).length >= 20);
        if (res.products?.[0]?.subCategory?.name) setSubCatName(res.products[0].subCategory.name);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const loadMore = () => {
    const nextPage = page + 1;
    api.get(`/user/products?subCategory=${id}&page=${nextPage}&limit=20`)
      .then(res => {
        setProducts(prev => [...prev, ...(res.products || [])]);
        setHasMore((res.products || []).length >= 20);
        setPage(nextPage);
      });
  };

  return (
    <div className="px-4 py-4 md:px-6">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/categories" className="md:hidden p-1.5 -ml-1 rounded-lg hover:bg-gray-100">
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">{subCatName || 'Products'}</h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-gray-400 text-lg">No products found</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {products.map(p => <ProductCard key={p._id} product={p} />)}
          </div>
          {hasMore && (
            <div className="text-center mt-6">
              <button onClick={loadMore} className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition">
                Load More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
