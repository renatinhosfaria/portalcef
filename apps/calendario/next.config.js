/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/calendario",
  output: "standalone",
  transpilePackages: [
    "@essencia/ui",
    "@essencia/shared",
    "@essencia/components",
  ],
};

module.exports = nextConfig;
