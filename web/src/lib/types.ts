export interface CjVariant {
  label: string;
  cjVid: string;
  cjSku?: string;
  cjCostUsd?: number;
  sellingPrice: number;
  mrp: number;
  stock: number;
  isActive?: boolean;
}

export interface ProductVariant {
  label: string;
  sku?: string;
  costPrice?: number;
  sellingPrice: number;
  mrp: number;
  stock: number;
  isActive?: boolean;
}

export interface Product {
  _id: string;
  source?: 'manual' | 'cj';
  name: string;
  description?: string;
  price: number;
  mrp: number;
  sellingPrice: number;
  images: string[];
  unit?: string;
  weight?: number;
  size?: string;
  stock: number;
  category?: string;
  subCategory?: string;
  partner?: { _id: string; name: string };
  platform?: string;
  brand?: string;
  highlights?: string[];
  specifications?: { key: string; value: string }[];
  hasVariants?: boolean;
  variants?: ProductVariant[];
  cjVariants?: CjVariant[];
  rating?: number;
  reviewCount?: number;
  gstPercent?: number;
  gstInclusive?: boolean;
  returnPolicy?: string;
  isReturnable?: boolean;
  isCOD?: boolean;
  color?: string;
  material?: string;
  warranty?: string;
  manufacturer?: string;
  countryOfOrigin?: string;
  packageContents?: string;
  hsnCode?: string;
}

export interface CartItem {
  productId: string;
  cjVid?: string;
  name: string;
  image: string | null;
  price: number;
  mrp?: number;
  unit?: string;
  partnerId: string;
  partnerName: string;
  platform: string;
  quantity: number;
  gstPercent?: number;
  gstInclusive?: boolean;
}

export interface Address {
  _id: string;
  label: string;
  address: string;
  houseNo?: string;
  city: string;
  state: string;
  pincode?: string;
  zip?: string;          // US ZIP code
  country?: 'IN' | 'US';
  landmark?: string;
  lat?: number;
  lng?: number;
  isDefault: boolean;
}

export interface Order {
  _id: string;
  orderNumber: string;
  status: string;
  cancelReason?: string;
  rejectedReason?: string;
  rejectedAt?: string;
  items: { name: string; quantity: number; total: number; price?: number; image?: string; product?: { _id: string; images: string[] } }[];
  subtotal: number;
  deliveryFee: number;
  platformFee: number;
  discount: number;
  grandTotal: number;
  paymentMethod: string;
  addressId?: string;
  partnerId?: string;
  note?: string;
  deliveryBoy?: { _id: string; name: string; phone: string };
  shipping?: {
    awb?: string;
    trackingUrl?: string;
    courierName?: string;
    provider?: string;
    status?: string;
    statusDetail?: string;
    estimatedDelivery?: string;
    label?: string;
    events?: { status: string; location: string; timestamp: string; description: string }[];
  };
  createdAt: string;
  expectedDelivery?: string;
  deliveredAt?: string;
  updatedAt?: string;
  paymentStatus?: string;
}

export interface User {
  _id: string;
  phone: string;
  name?: string;
  email?: string;
  isProfileComplete: boolean;
  referralCode?: string;
}

export interface Category {
  _id: string;
  name: string;
  icon?: string;
  image?: string;
}

export interface HomeSection {
  _id?: string;
  id?: string;
  type: string;
  title?: string;
  items?: any[];
  data?: any;
  bgColor?: string;
  bgImage?: string;
}

export interface AppConfig {
  brand_name?: string;
  brand_logo_url?: string;
  brand_logo_dark_url?: string;
  brand_favicon_url?: string;
  brand_primary_color?: string;
  brand_accent_color?: string;
  ddgo_brand_color?: string;
  app_bar_bg_image?: string;
  app_bar_color_light?: string;
  category_heading_color?: string;
  category_text_color?: string;
  category_bg_color?: string;
  cod_enabled?: boolean;
  wallet_enabled?: boolean;
  support_phone?: string;
  support_phone_alt?: string;
  support_email?: string;
  support_whatsapp?: string;
  company_name?: string;
  company_address?: string;
  privacy_policy_url?: string;
  terms_url?: string;
  about_us_url?: string;
  instagram_url?: string;
  legal_privacy_html?: string;
  legal_terms_html?: string;
  legal_refund_html?: string;
  legal_vendor_html?: string;
  [key: string]: unknown;
}
