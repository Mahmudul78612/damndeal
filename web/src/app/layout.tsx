import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import MobileNav from "@/components/layout/MobileNav";
import MobileHeader from "@/components/layout/MobileHeader";
import DesktopNavbar from "@/components/layout/DesktopNavbar";
import Footer from "@/components/layout/Footer";
import GlobalLoginModal from "@/components/GlobalLoginModal";
import InAppShellClass from "@/components/InAppShellClass";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://damndeal.in";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "DamnDeal - Best Deals Online",
    template: "%s | DamnDeal",
  },
  description: "Shop top deals on electronics, fashion, home essentials, beauty, and more on DamnDeal with fast delivery across India.",
  keywords: [
    "DamnDeal",
    "online shopping India",
    "best deals",
    "discount products",
    "electronics",
    "fashion",
    "home products",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
    siteName: "DamnDeal",
    title: "DamnDeal - Best Deals Online",
    description: "Shop top deals on electronics, fashion, home essentials, beauty, and more on DamnDeal.",
    images: [
      {
        url: "/android-chrome-512x512.png",
        width: 512,
        height: 512,
        alt: "DamnDeal",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DamnDeal - Best Deals Online",
    description: "Shop top deals on electronics, fashion, home essentials, beauty, and more on DamnDeal.",
    images: ["/android-chrome-512x512.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "icon",
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        rel: "icon",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#7C3AED",
  // Without this, env(safe-area-inset-*) reports 0 and the .safe-top padding
  // on the home header does nothing — which is why the page slid under the
  // status bar inside the Android app while every inner page looked right.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <InAppShellClass />
        <Providers>
          <MobileHeader />
          <DesktopNavbar />
          <main className="min-h-screen max-w-[1400px] mx-auto pb-16 md:pb-0">{children}</main>
          <Footer />
          <MobileNav />
          <GlobalLoginModal />
        </Providers>
      </body>
    </html>
  );
}
