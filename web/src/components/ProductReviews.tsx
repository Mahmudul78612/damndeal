'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Star, X, Loader2 } from 'lucide-react';
import { api, imgUrl } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface ReviewItem {
  _id: string;
  rating: number;
  title?: string;
  comment?: string;
  images?: string[];
  userName: string;
  userAvatar?: string;
  createdAt: string;
  status?: 'pending' | 'approved' | 'rejected';
}

interface Summary {
  average: number;
  total: number;
  breakdown: Record<string, number>;
}

export default function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<Summary>({ average: 0, total: 0, breakdown: {} });
  const [loading, setLoading] = useState(true);
  const [showWrite, setShowWrite] = useState(false);
  const [myReview, setMyReview] = useState<ReviewItem | null>(null);
  const { isLoggedIn, openLoginModal } = useAuth();

  const load = () => {
    setLoading(true);
    api.get(`/user/products/${productId}/reviews?limit=10`)
      .then((res) => {
        setReviews(res.reviews || []);
        if (res.summary) setSummary(res.summary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    if (isLoggedIn) {
      api.get(`/user/products/${productId}/my-review`)
        .then((res) => setMyReview(res.review || null))
        .catch(() => {});
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [productId, isLoggedIn]);

  const handleClickWrite = () => {
    if (!isLoggedIn) { openLoginModal(`/product/${productId}`); return; }
    if (myReview) return;
    setShowWrite(true);
  };

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Ratings & Reviews</h3>
        <button
          onClick={handleClickWrite}
          disabled={!!myReview}
          className="text-sm font-semibold text-primary disabled:text-gray-400"
        >
          {myReview ? (myReview.status === 'pending' ? 'Awaiting approval' : 'Reviewed') : 'Write a Review'}
        </button>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-6 pb-4 border-b border-gray-100">
        <div className="text-center">
          <div className="flex items-center gap-1">
            <span className="text-3xl font-extrabold text-gray-900">{summary.average.toFixed(1)}</span>
            <Star size={20} className="fill-yellow-400 text-yellow-400" />
          </div>
          <p className="text-xs text-gray-500 mt-1">{summary.total} {summary.total === 1 ? 'review' : 'reviews'}</p>
        </div>
        <div className="flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((s) => {
            const count = summary.breakdown[s] || 0;
            const pct = summary.total ? (count / summary.total) * 100 : 0;
            return (
              <div key={s} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-gray-600">{s}</span>
                <Star size={10} className="fill-yellow-400 text-yellow-400" />
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-yellow-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-6 text-right text-gray-500">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* List */}
      <div className="mt-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : reviews.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-6">No reviews yet. Be the first to review!</p>
        ) : (
          reviews.map((r) => (
            <div key={r._id} className="pb-4 border-b border-gray-50 last:border-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden text-xs font-bold text-gray-500">
                  {r.userAvatar ? <Image src={imgUrl(r.userAvatar)} alt="" width={32} height={32} /> : (r.userName?.[0] || 'U').toUpperCase()}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{r.userName}</p>
                  <p className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                </div>
                <div className="flex items-center gap-0.5 bg-green-600 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                  {r.rating} <Star size={10} className="fill-white" />
                </div>
              </div>
              {r.title && <p className="text-sm font-bold text-gray-900 mb-0.5">{r.title}</p>}
              {r.comment && <p className="text-sm text-gray-700 whitespace-pre-line">{r.comment}</p>}
              {r.images && r.images.length > 0 && (
                <div className="flex gap-2 mt-2 overflow-x-auto">
                  {r.images.map((img, i) => (
                    <Image key={i} src={imgUrl(img)} alt="" width={64} height={64} className="w-16 h-16 object-cover rounded border border-gray-100" />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showWrite && (
        <WriteReviewModal
          productId={productId}
          onClose={() => setShowWrite(false)}
          onDone={() => { setShowWrite(false); load(); }}
        />
      )}
    </section>
  );
}

function WriteReviewModal({ productId, onClose, onDone }: { productId: string; onClose: () => void; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!rating) { setError('Please select a rating'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/user/products/${productId}/reviews`, { rating, title, comment });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">Write a Review</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Your rating</p>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(s)}
                className="p-1"
              >
                <Star
                  size={32}
                  className={(hover || rating) >= s ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                />
              </button>
            ))}
          </div>
        </div>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short title (optional)"
          maxLength={120}
          className="w-full mb-3 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary"
        />
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience..."
          maxLength={2000}
          rows={4}
          className="w-full mb-3 px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-primary resize-none"
        />

        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <p className="text-[11px] text-gray-400 mb-3">Your review will be published after admin approval.</p>

        <button
          onClick={submit}
          disabled={submitting || !rating}
          className="w-full py-3 bg-primary text-white rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
          Submit Review
        </button>
      </div>
    </div>
  );
}
