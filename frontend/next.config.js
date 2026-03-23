/** @type {import('next').NextConfig} */
if (!process.env.NEXT_PUBLIC_API_URL) {
  throw new Error("Missing required env var NEXT_PUBLIC_API_URL");
}

const nextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
