/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/usuarios",
  output: "standalone",
  transpilePackages: [
    "@essencia/ui",
    "@essencia/shared",
    "@essencia/components",
  ],
};

module.exports = nextConfig;
