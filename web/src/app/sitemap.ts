import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://damndeal.in';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://damndeal.in/api';

async function fetchJson(url: string) {
  try {
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/categories`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: 'daily', priority: 0.7 },
    { url: `${SITE_URL}/legal`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/legal/terms`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/legal/privacy`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/legal/refund`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/legal/vendor`, lastModified: now, changeFrequency: 'monthly', priority: 0.3 },
  ];

  const [catData, productData] = await Promise.all([
    fetchJson(`${API_URL}/categories?platform=damndeal`),
    fetchJson(`${API_URL}/user/products?limit=500&platform=damndeal`),
  ]);

  const categoryRoutes: MetadataRoute.Sitemap = Array.isArray(catData?.categories)
    ? catData.categories.map((c: any) => ({
        url: `${SITE_URL}/categories/${c._id}`,
        lastModified: c.updatedAt ? new Date(c.updatedAt) : now,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }))
    : [];

  const productRoutes: MetadataRoute.Sitemap = Array.isArray(productData?.products)
    ? productData.products.map((p: any) => ({
        url: `${SITE_URL}/product/${p._id}`,
        lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }))
    : [];

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
