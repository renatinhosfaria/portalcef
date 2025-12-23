"use client";

import { motion, type Variants } from "framer-motion";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

const fadeIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
};

interface StatsCardProps {
  title: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  icon: LucideIcon;
  color: string;
  bg: string;
}

export function StatsCard({
  title,
  value,
  trend,
  trendUp,
  icon: Icon,
  color,
  bg,
}: StatsCardProps) {
  return (
    <motion.div
      variants={fadeIn}
      className="bg-white/80 backdrop-blur-xl border border-white/60 p-6 rounded-3xl shadow-lg shadow-slate-200/40 hover:scale-[1.02] transition-transform duration-300 cursor-default group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("p-3 rounded-2xl transition-colors", bg)}>
          <Icon className={cn("w-6 h-6", color)} />
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full",
              trendUp
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700",
            )}
          >
            {trendUp ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowUpRight className="w-3 h-3 rotate-90" />
            )}
            {trend}
          </div>
        )}
      </div>
      <div>
        <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-black text-slate-800 tracking-tight group-hover:text-[#A3D154] transition-colors">
          {value}
        </h3>
      </div>
    </motion.div>
  );
}
