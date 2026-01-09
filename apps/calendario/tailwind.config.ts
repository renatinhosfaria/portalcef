import sharedConfig from "@essencia/tailwind-config";
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./features/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/components/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/shared/src/**/*.{js,ts,jsx,tsx}",
  ],
  // Safelist para cores dinâmicas do calendário (eventTypeConfig)
  safelist: [
    // Background colors
    "bg-blue-100",
    "bg-red-100",
    "bg-orange-100",
    "bg-gray-100",
    "bg-yellow-100",
    "bg-purple-100",
    "bg-slate-100",
    "bg-green-100",
    // Text colors
    "text-blue-700",
    "text-red-700",
    "text-orange-700",
    "text-gray-700",
    "text-yellow-800",
    "text-purple-700",
    "text-slate-700",
    "text-green-700",
    // Border colors
    "border-blue-300",
    "border-red-300",
    "border-orange-300",
    "border-gray-300",
    "border-yellow-300",
    "border-purple-300",
    "border-slate-300",
    "border-green-300",
  ],
  presets: [sharedConfig],
};

export default config;
