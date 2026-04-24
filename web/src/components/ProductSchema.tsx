'use client';

import { useEffect } from 'react';
import { generateProductSchema, ProductSchemaData } from '@/lib/productSchema';

export default function ProductSchema({ product }: { product: ProductSchemaData }) {
  useEffect(() => {
    try {
      // Create and inject JSON-LD script tag
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      const schema = generateProductSchema(product);
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);

      // Store reference for cleanup
      const cleanup = () => {
        try {
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
        } catch (e) {
          /* ignore cleanup errors */
        }
      };

      return cleanup;
    } catch (error) {
      console.error('Failed to inject product schema:', error);
      return undefined;
    }
  }, [product]);

  return null; // Component doesn't render anything visual
}
