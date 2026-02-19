/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/planejamento",
  output: "standalone",
  transpilePackages: [
    "@essencia/ui",
    "@essencia/shared",
    "@essencia/components",
  ],
};

module.exports = nextConfig;
