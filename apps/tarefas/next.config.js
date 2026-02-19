/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/tarefas",
  output: "standalone",
  transpilePackages: ["@essencia/ui", "@essencia/shared", "@essencia/components"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = nextConfig;
