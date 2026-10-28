/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/eventos-admin",
  output: "standalone",
  transpilePackages: [
    "@essencia/ui",
    "@essencia/shared",
    "@essencia/components",
  ],
};

module.exports = nextConfig;
