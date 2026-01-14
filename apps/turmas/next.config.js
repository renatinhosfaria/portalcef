/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/turmas",
  transpilePackages: [
    "@essencia/ui",
    "@essencia/shared",
    "@essencia/components",
  ],
};

module.exports = nextConfig;
