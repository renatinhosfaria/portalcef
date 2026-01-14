/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/usuarios",
  transpilePackages: [
    "@essencia/ui",
    "@essencia/shared",
    "@essencia/components",
  ],
};

module.exports = nextConfig;
