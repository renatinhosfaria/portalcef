/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/planejamento",
  transpilePackages: [
    "@essencia/ui",
    "@essencia/shared",
    "@essencia/components",
  ],
};

module.exports = nextConfig;
