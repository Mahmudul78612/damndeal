import Link from 'next/link';
import { FileText, Shield, RefreshCw, Briefcase, ChevronRight } from 'lucide-react';

const ITEMS = [
  { slug: 'terms', label: 'Terms & Conditions', desc: 'Rules and conditions for using DamnDeal', icon: FileText, color: 'from-violet-500 to-purple-600' },
  { slug: 'privacy', label: 'Privacy Policy', desc: 'How we handle your data and privacy requests', icon: Shield, color: 'from-blue-500 to-cyan-600' },
  { slug: 'refund', label: 'Refund Policy', desc: 'Returns, cancellations & refund process', icon: RefreshCw, color: 'from-emerald-500 to-teal-600' },
  { slug: 'vendor', label: 'Vendor / Partner Terms', desc: 'Terms for sellers and partners on DamnDeal', icon: Briefcase, color: 'from-amber-500 to-orange-600' },
];

export const metadata = {
  title: 'Legal & Policies — DamnDeal',
  description: 'DamnDeal legal documents: terms, privacy, refund and vendor policies.',
};

export default function LegalIndex() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">
        <div className="mb-6">
          <h1 className="text-xl md:text-3xl font-bold text-gray-900">Legal & Policies</h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">All DamnDeal policies and legal documents in one place.</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {ITEMS.map(item => {
            const Icon = item.icon;
            return (
              <Link
                key={item.slug}
                href={`/legal/${item.slug}`}
                className="group bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg hover:border-violet-200 transition-all flex items-start gap-3"
              >
                <div className={`shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center text-white shadow-md`}>
                  <Icon size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm md:text-base font-bold text-gray-900 group-hover:text-violet-600 transition">{item.label}</h3>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-violet-500 transition" />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
