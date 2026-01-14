/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/calendario",
  transpilePackages: [
    "@essencia/ui",
    "@essencia/shared",
    "@essencia/components",
  ],
};

module.exports = nextConfig;
