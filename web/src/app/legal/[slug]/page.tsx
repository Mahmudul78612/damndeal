import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Mail, Phone, Globe, ChevronRight, FileText, Shield, RefreshCw, Briefcase } from 'lucide-react';
import { LEGAL_DOCS, LEGAL_SLUGS } from '@/lib/legal-content';
import type { Metadata } from 'next';

// Re-render at most every 60s so admin edits propagate without a full deploy
export const revalidate = 60;

const LEGAL_KEY_MAP: Record<string, string> = {
  privacy: 'legal_privacy_html',
  terms: 'legal_terms_html',
  refund: 'legal_refund_html',
  vendor: 'legal_vendor_html',
};

const SERVER_API = process.env.NEXT_PUBLIC_API_URL || 'https://damndeal.in/api';

type AppCfg = Record<string, unknown>;

async function fetchAppConfig(): Promise<AppCfg> {
  try {
    const res = await fetch(`${SERVER_API}/app-config`, { next: { revalidate: 60 } });
    if (!res.ok) return {};
    const json = await res.json();
    return json.config || {};
  } catch {
    return {};
  }
}

const ICONS: Record<string, typeof FileText> = {
  terms: FileText,
  privacy: Shield,
  refund: RefreshCw,
  vendor: Briefcase,
};

const LABELS: Record<string, string> = {
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
  refund: 'Refund Policy',
  vendor: 'Vendor / Partner Terms',
};

export function generateStaticParams() {
  return LEGAL_SLUGS.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = LEGAL_DOCS[slug];
  if (!doc) return { title: 'Legal — DamnDeal' };
  return {
    title: `${doc.title} — DamnDeal`,
    description: doc.intro?.[0] || doc.title,
  };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = LEGAL_DOCS[slug];
  if (!doc) notFound();

  const cfg = await fetchAppConfig();
  const overrideKey = LEGAL_KEY_MAP[slug];
  const overrideHtml = overrideKey ? (cfg[overrideKey] as string | undefined) : '';
  const hasOverride = !!(overrideHtml && overrideHtml.trim());

  // Override contact details with admin settings if provided
  const contactEmail   = (cfg.support_email as string) || doc.contact?.email || '';
  const contactPhone   = (cfg.support_phone as string) || doc.contact?.phone || '';
  const contactWebsite = doc.contact?.website || '';
  const brandName      = (cfg.brand_name as string) || (cfg.company_name as string) || 'DamnDeal';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-6 md:py-10">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 text-xs text-gray-500 mb-4">
          <Link href="/" className="hover:text-violet-600">Home</Link>
          <ChevronRight size={12} />
          <span className="text-gray-700 font-medium">Legal</span>
          <ChevronRight size={12} />
          <span className="text-gray-900 font-semibold">{LABELS[slug] || doc.title}</span>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-8 mb-4">
          <h1 className="text-xl md:text-3xl font-bold text-gray-900 leading-tight">
            {doc.title}
          </h1>
          {doc.effectiveDate && (
            <p className="text-xs md:text-sm text-gray-500 mt-2">
              Last updated: <span className="font-medium text-gray-700">{doc.effectiveDate}</span>
            </p>
          )}
        </div>

        {/* Quick links to other legal docs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {LEGAL_SLUGS.map(s => {
            const Icon = ICONS[s] || FileText;
            const isActive = s === slug;
            return (
              <Link
                key={s}
                href={`/legal/${s}`}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold transition border ${
                  isActive
                    ? 'bg-violet-600 text-white border-violet-600 shadow-md'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                }`}
              >
                <Icon size={14} className="shrink-0" />
                <span className="truncate">{LABELS[s]}</span>
              </Link>
            );
          })}
        </div>

        {/* Body */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 md:p-8">
          {hasOverride ? (
            <div
              className="legal-html prose prose-sm md:prose max-w-none text-gray-700 prose-headings:text-gray-900 prose-a:text-violet-600"
              dangerouslySetInnerHTML={{ __html: overrideHtml as string }}
            />
          ) : (
            <>
              {/* Intro */}
              {doc.intro?.map((p, i) => (
                <p key={i} className="text-sm md:text-base text-gray-700 leading-relaxed mb-3">
                  {p}
                </p>
              ))}

              {/* Sections */}
              <div className="mt-6 space-y-6">
                {doc.sections.map((section, idx) => (
                  <section key={idx} className="border-t border-gray-100 pt-5">
                    {section.heading && (
                      <h2 className="text-base md:text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-1 h-5 bg-violet-600 rounded-full" />
                        {section.heading}
                      </h2>
                    )}
                    {section.paragraphs?.map((p, i) => (
                      <p key={i} className="text-sm text-gray-700 leading-relaxed mb-2.5">
                        {p}
                      </p>
                    ))}
                    {section.bullets && section.bullets.length > 0 && (
                      <ul className="space-y-1.5 mt-2 ml-2">
                        {section.bullets.map((b, i) => (
                          <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                            <span className="text-violet-500 mt-0.5">•</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}

          {/* Contact (always uses live admin settings when set) */}
          {(contactEmail || contactPhone || contactWebsite) && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Need Assistance?</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {contactEmail && (
                  <a
                    href={`mailto:${contactEmail}`}
                    className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 rounded-lg text-xs text-violet-700 hover:bg-violet-100 transition"
                  >
                    <Mail size={14} className="shrink-0" />
                    <span className="truncate font-medium">{contactEmail}</span>
                  </a>
                )}
                {contactPhone && (
                  <a
                    href={`tel:${contactPhone.replace(/[^+0-9]/g, '')}`}
                    className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 rounded-lg text-xs text-violet-700 hover:bg-violet-100 transition"
                  >
                    <Phone size={14} className="shrink-0" />
                    <span className="font-medium">{contactPhone}</span>
                  </a>
                )}
                {contactWebsite && (
                  <a
                    href={`https://${contactWebsite}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2.5 bg-violet-50 rounded-lg text-xs text-violet-700 hover:bg-violet-100 transition"
                  >
                    <Globe size={14} className="shrink-0" />
                    <span className="truncate font-medium">{contactWebsite}</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-6">
          &copy; {new Date().getFullYear()} {brandName}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
