'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function WalletPage() {
  const { isLoggedIn, loading: authLoading, openLoginModal } = useAuth();
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) { openLoginModal('/wallet'); return; }
    api.get('/user/wallet/transactions')
      .then(res => {
        setBalance(res.balance || 0);
        setTransactions(res.transactions || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authLoading, isLoggedIn, router]);

  if (loading) return (
    <div className="px-4 py-4 animate-pulse">
      <div className="skeleton h-28 rounded-2xl mb-4" />
      <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)}</div>
    </div>
  );

  return (
    <div className="px-4 py-4 md:px-6 max-w-2xl mx-auto">
      {/* Balance card */}
      <div className="bg-gradient-to-br from-primary to-primary-dark rounded-2xl p-6 text-white mb-4 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <WalletIcon size={24} />
          <span className="text-sm font-medium opacity-80">Wallet Balance</span>
        </div>
        <p className="text-4xl font-extrabold">₹{balance.toFixed(0)}</p>
      </div>

      {/* Transactions */}
      <h2 className="text-sm font-bold text-gray-900 mb-3">Transaction History</h2>
      {transactions.length === 0 ? (
        <p className="text-center text-gray-400 py-10">No transactions yet</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((tx: any, i: number) => {
            const isCredit = tx.type === 'credit';
            return (
              <div key={i} className="bg-white rounded-2xl p-3 shadow-sm flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCredit ? 'bg-green-100' : 'bg-red-100'}`}>
                  {isCredit ? <ArrowDownLeft size={18} className="text-green-600" /> : <ArrowUpRight size={18} className="text-red-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{tx.description || tx.reason || (isCredit ? 'Credited' : 'Debited')}</p>
                  <p className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <span className={`text-sm font-bold ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                  {isCredit ? '+' : '-'}₹{Math.abs(tx.amount).toFixed(0)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
