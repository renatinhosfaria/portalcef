import type { Config } from "tailwindcss";
import sharedConfig from "@essencia/tailwind-config";

export default {
  ...sharedConfig,
  content: [
    ...(Array.isArray(sharedConfig.content) ? sharedConfig.content : []),
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
} satisfies Config;
