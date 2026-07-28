'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Product } from '@/lib/types';
import { imgUrl, CURRENCY_SYMBOL } from '@/lib/api';

export default function ProductCard({ product }: { product: Product }) {
  const discount = (product.mrp || product.price) > product.sellingPrice
    ? Math.round((((product.mrp || product.price) - product.sellingPrice) / (product.mrp || product.price)) * 100)
    : 0;

  return (
    <Link
      href={`/product/${product._id}`}
      prefetch={false}
      className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group block"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <Image
          src={imgUrl(product.images?.[0])}
          alt={product.name}
          fill
          className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 50vw, 20vw"
        />
        {product.source === 'cj' && (
          <span className="absolute bottom-1.5 right-1.5 bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow">
            ✈ International
          </span>
        )}
        {discount > 0 && (
          <span className="absolute top-1.5 left-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
            {discount}% OFF
          </span>
        )}
        {product.stock <= 0 && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-bold text-xs bg-black/60 px-2 py-0.5 rounded">Out of Stock</span>
          </div>
        )}
      </div>

      <div className="p-2">
        <h3
          className="text-xs font-medium text-gray-800 leading-tight min-h-[2.1rem]"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {product.name}
        </h3>
        {product.unit && (
          <p className="text-[10px] text-gray-400 mt-0.5">{product.weight ? `${product.weight} ` : ''}{product.unit}</p>
        )}
        {product.hasVariants && product.variants && product.variants.length > 0 && (
          <div className="flex flex-wrap gap-0.5 mt-1">
            {product.variants.filter(v => v.isActive !== false && v.stock > 0).slice(0, 5).map((v, i) => (
              <span key={i} className="text-[9px] px-1 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">
                {v.label}
              </span>
            ))}
            {product.variants.filter(v => v.isActive !== false && v.stock > 0).length > 5 && (
              <span className="text-[9px] px-1 py-0.5 text-gray-400">+{product.variants.filter(v => v.isActive !== false && v.stock > 0).length - 5}</span>
            )}
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-bold text-gray-900">{CURRENCY_SYMBOL}{product.sellingPrice}</span>
          {discount > 0 && (
            <span className="text-[10px] text-gray-400 line-through">{CURRENCY_SYMBOL}{product.mrp || product.price}</span>
          )}
          {product.rating && product.rating > 0 ? (
            <span className="flex items-center gap-0.5 bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded ml-auto">
              {product.rating.toFixed(1)} ★
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
