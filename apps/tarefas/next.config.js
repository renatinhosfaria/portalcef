/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: "/tarefas",
  transpilePackages: ["@essencia/ui", "@essencia/shared", "@essencia/components"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

module.exports = nextConfig;
