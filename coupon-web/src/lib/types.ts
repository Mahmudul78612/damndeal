export interface User {
  id?: string;
  _id?: string;
  name?: string | null;
  phone?: string;
  email?: string | null;
  role?: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon?: string;
  packs?: { claims: number; priceINR: number; priceUSD: number; label?: string }[];
}

export interface Vendor {
  _id: string;
  businessName: string;
  slug: string;
  logo?: string;
  isVerifiedBadge?: boolean;
  description?: string;
  website?: string;
  address?: string;
}

export interface Campaign {
  _id: string;
  title: string;
  slug: string;
  offerText: string;
  offerType?: string;
  offerValue?: number;
  description?: string;
  terms?: string;
  bannerImage?: string;
  tileImage?: string;
  isOnline?: boolean;
  redirectUrl?: string;
  claimedCount: number;
  totalQuota: number;
  endAt: string;
  featured?: { active: boolean };
  vendor?: Vendor;
  category?: { _id?: string; name: string; slug: string };
  status?: string;
}

export interface Claim {
  _id: string;
  code: string;
  status: "claimed" | "redeemed" | "expired" | "cancelled";
  claimedAt: string;
  redeemedAt?: string | null;
  campaign?: Campaign;
  vendor?: Vendor;
}

export interface Section {
  _id: string;
  type: string;
  title?: string;
  data?: Record<string, unknown> & {
    text?: string; link?: string; bgColor?: string;
    banners?: { image: string; link?: string; title?: string }[];
    limit?: number;
  };
  items?: unknown[];
}
