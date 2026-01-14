/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/escolas",
  transpilePackages: [
    "@essencia/ui",
    "@essencia/shared",
    "@essencia/components",
  ],
};

module.exports = nextConfig;
