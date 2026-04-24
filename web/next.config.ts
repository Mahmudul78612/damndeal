import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ["10.208.53.234", "localhost"],
  async rewrites() {
    return [
      {
        source: "/proxy-api/:path*",
        destination: isProd
          ? "http://127.0.0.1:5000/api/:path*"
          : "https://damndeal.in/api/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: isProd
          ? "http://127.0.0.1:5000/uploads/:path*"
          : "https://damndeal.in/uploads/:path*",
      },
    ];
  },
};

export default nextConfig;
