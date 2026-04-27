/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  images: {
    domains: ["cahayo.co.ke", "localhost"],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://backend:8000/api"}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
