/** @type {import('next').NextConfig} */
const nextConfig = {
  // REMOVE output: "export"
  images: {
    unoptimized: true,
  },

  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
