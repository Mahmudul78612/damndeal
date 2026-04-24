import type { Metadata } from 'next';
import { imgUrl } from '@/lib/api';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://damndeal.in/api';
const SITE = 'https://damndeal.in';

function toPlainText(input: string = ''): string {
  return String(input)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  try {
    const res = await fetch(`${API}/user/products?_id=${id}`, {
      next: { revalidate: 300 },
    });
    const data = await res.json();
    const product = Array.isArray(data?.products) ? data.products[0] : data?.product;

    if (!product) {
      return { title: 'Product | DamnDeal' };
    }

    const categoryName = typeof product.category === 'object' ? product.category?.name : '';
    const title = `${product.name}${categoryName ? ` - ${categoryName}` : ''} | DamnDeal`;
    const shortDesc = toPlainText(product.description || '');
    const description =
      shortDesc.slice(0, 160) ||
      `Buy ${product.name} at ₹${product.sellingPrice} on DamnDeal. Best deals & fast delivery.`;
    const imagePath = product.images?.[0];
    const image = imagePath
      ? (imagePath.startsWith('http') ? imagePath : `${API.replace('/api', '')}${imagePath}`)
      : `${SITE}/assets/logo.webp`;
    const url = `${SITE}/product/${id}`;

    return {
      title,
      description,
      keywords: [
        product.name,
        categoryName,
        product.brand || '',
        'buy online',
        'best price',
        'DamnDeal',
      ].filter(Boolean),
      robots: {
        index: true,
        follow: true,
      },
      openGraph: {
        title,
        description,
        url,
        siteName: 'DamnDeal',
        images: [
          {
            url: image,
            width: 1200,
            height: 1200,
            alt: product.name,
          },
        ],
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [image],
      },
      other: {
        'product:price:amount': String(product.sellingPrice || ''),
        'product:price:currency': 'INR',
        'product:availability': (product.stock || 0) > 0 ? 'in stock' : 'out of stock',
      },
      alternates: { canonical: url },
    };
  } catch {
    return { title: 'Product | DamnDeal' };
  }
}

export default function ProductLayout({ children }: { children: React.ReactNode }) {
  return children;
}
