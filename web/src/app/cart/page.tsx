'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { imgUrl, CURRENCY_SYMBOL } from "@/lib/api";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from 'lucide-react';

export default function CartPage() {
  const { items, itemCount, subtotal, totalGst, totalSavings, partnerName, updateQty, removeItem, clear } = useCart();
  const { isLoggedIn, openLoginModal } = useAuth();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <ShoppingBag size={48} className="text-gray-300 mb-3" />
        <h2 className="text-lg font-bold text-gray-900 mb-1">Your cart is empty</h2>
        <p className="text-sm text-gray-400 mb-4">Add some products to get started</p>
        <Link href="/" className="px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary-dark transition">
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-28 md:pb-6">
      <div className="px-4 py-3 md:px-4 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">Cart ({itemCount})</h1>
          <button onClick={clear} className="text-xs text-red-500 font-medium hover:text-red-600">Clear All</button>
        </div>

        {partnerName && (
          <p className="text-xs text-gray-500 mb-3">From: <span className="font-medium text-gray-700">{partnerName}</span></p>
        )}

        {/* Items */}
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.productId} className="bg-white rounded-xl p-2.5 flex gap-2.5 shadow-sm">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-50 shrink-0">
                <Image src={imgUrl(item.image || '')} alt={item.name} width={64} height={64} className="object-cover w-full h-full" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-medium text-gray-900 line-clamp-2">{item.name}</h3>
                {item.unit && <p className="text-[10px] text-gray-400 mt-0.5">{item.unit}</p>}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-sm font-bold text-gray-900">{CURRENCY_SYMBOL}{(item.price * item.quantity).toFixed(0)}</span>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => removeItem(item.productId)} className="p-1 text-red-400 hover:text-red-500">
                      <Trash2 size={12} />
                    </button>
                    <div className="flex items-center bg-primary/10 rounded-md overflow-hidden">
                      <button onClick={() => updateQty(item.productId, item.quantity - 1)} className="p-1 text-primary hover:bg-primary/20">
                        <Minus size={12} />
                      </button>
                      <span className="text-xs font-bold text-primary w-5 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.productId, item.quantity + 1)} className="p-1 text-primary hover:bg-primary/20">
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bill */}
        <div className="bg-white rounded-xl p-3 mt-3 shadow-sm">
          <h3 className="text-xs font-bold text-gray-900 mb-2">Price Details</h3>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Price ({itemCount} items)</span>
              <span className="font-medium">{CURRENCY_SYMBOL}{(subtotal + totalSavings).toFixed(0)}</span>
            </div>
            {totalSavings > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span className="font-medium">− {CURRENCY_SYMBOL}{totalSavings.toFixed(0)}</span>
              </div>
            )}
            {totalGst > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">GST (included)</span>
                <span className="text-gray-400">{CURRENCY_SYMBOL}{totalGst.toFixed(0)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-400">
              <span>Delivery & fees</span>
              <span>Calculated at checkout</span>
            </div>
            <div className="border-t border-gray-100 pt-2 flex justify-between">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-lg text-gray-900">{CURRENCY_SYMBOL}{subtotal.toFixed(0)}</span>
            </div>
            {totalSavings > 0 && (
              <p className="text-green-600 text-[11px] font-medium text-center pt-1">You will save {CURRENCY_SYMBOL}{totalSavings.toFixed(0)} on this order</p>
            )}
          </div>
        </div>
      </div>

      {/* Sticky checkout */}
      <div className="fixed bottom-12 md:bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-30 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] safe-bottom">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400">Total</p>
            <p className="text-lg font-extrabold text-gray-900">{CURRENCY_SYMBOL}{subtotal.toFixed(0)}</p>
          </div>
          {isLoggedIn ? (
            <Link href="/checkout" className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-lg font-bold text-xs hover:bg-primary-dark transition">
              Checkout <ArrowRight size={14} />
            </Link>
          ) : (
            <button onClick={() => openLoginModal('/checkout')} className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-bold text-xs hover:bg-primary-dark transition">
              Login to Checkout <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
