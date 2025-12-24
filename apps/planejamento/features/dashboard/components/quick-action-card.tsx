"use client";

import { motion, type Variants } from "framer-motion";

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

export type QuickActionCardProps = {
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
};

export function QuickActionCard({
  title,
  desc,
  icon: Icon,
  color,
}: QuickActionCardProps) {
  return (
    <motion.div
      variants={fadeIn}
      className={`relative overflow-hidden rounded-3xl p-6 text-white cursor-pointer shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] bg-gradient-to-br ${color}`}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-4 backdrop-blur-sm">
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-lg mb-1">{title}</h3>
        <p className="text-sm text-white/80">{desc}</p>
      </div>
    </motion.div>
  );
}
