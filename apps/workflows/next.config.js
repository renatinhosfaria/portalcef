/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/workflows",
  output: "standalone",
  transpilePackages: [
    "@essencia/ui",
    "@essencia/shared",
    "@essencia/components",
  ],
};

module.exports = nextConfig;
