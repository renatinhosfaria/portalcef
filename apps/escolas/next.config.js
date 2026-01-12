/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ["@essencia/ui", "@essencia/shared"],

  // Docker/Windows file watching support
  webpack: (config, { isServer }) => {
    // Enable polling for file changes in Docker environments
    if (process.env.DOCKER_ENV === "true") {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
        ignored: /node_modules|\.next|\.turbo|dist|coverage|\.git/,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
