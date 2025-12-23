"use client";

import { cn } from "@essencia/ui/lib/utils";
import { motion, type Variants } from "framer-motion";
import { type LucideIcon } from "lucide-react";

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

interface StatsCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  description?: string;
  color?: string; // Tailwind color class for text and mild bg
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  color = "text-slate-600",
}: StatsCardProps) {
  // Extract base color name to create bg opacity variant (simple approximation)
  // In a real robust system we'd pass separate bg class or use consistent design tokens

  return (
    <motion.div
      variants={fadeIn}
      className="bg-white/80 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-lg shadow-slate-200/40 hover:scale-[1.02] transition-transform duration-300 cursor-default group"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            "p-3 rounded-2xl bg-slate-100/80 transition-colors group-hover:bg-slate-200/50",
          )}
        >
          <Icon className={cn("w-6 h-6", color)} />
        </div>
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-black text-slate-900 tracking-tight">
          {value}
        </h3>
        {description && (
          <p className="text-xs text-slate-400 mt-2 font-medium">
            {description}
          </p>
        )}
      </div>
    </motion.div>
  );
}
