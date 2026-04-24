/**
 * Generate Product JSON-LD schema for Google rich snippets
 * https://schema.org/Product
 */

export interface ProductSchemaData {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  image?: string;
  brand?: string;
  category?: string;
  inStock: boolean;
  stock?: number;
  rating?: number;
  reviewCount?: number;
}

export function generateProductSchema(data: ProductSchemaData): object {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://damndeal.in';

  const schema: any = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: String(data.name || '').trim(),
    description: String(data.description || `Buy ${data.name} at ₹${data.price} on DamnDeal. Best deals & fast delivery.`).trim(),
    brand: {
      '@type': 'Brand',
      name: String(data.brand || 'DamnDeal').trim(),
    },
    image: String(data.image || `${siteUrl}/assets/logo.webp`).trim(),
    sku: String(data.id || '').trim(),
    offers: {
      '@type': 'Offer',
      url: `${siteUrl}/product/${data.id}`,
      priceCurrency: String(data.currency || 'INR').trim(),
      price: String(Math.max(0, Number(data.price) || 0)),
      availability: data.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'DamnDeal',
      },
    },
  };

  // Add rating if available
  if (data.rating && data.reviewCount && Number(data.reviewCount) > 0) {
    const ratingValue = Math.min(5, Math.max(1, Number(data.rating) || 0));
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: String(ratingValue),
      reviewCount: String(Math.max(0, Number(data.reviewCount) || 0)),
    };
  }

  return schema;
}
