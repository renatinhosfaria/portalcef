/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@essencia/ui", "@essencia/shared"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = nextConfig;
