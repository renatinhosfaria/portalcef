"use client";

import { StatsCard } from "@essencia/ui/components/stats-card";
import { motion, type Variants } from "framer-motion";
import { Clock, Shield, UserCheck, Users } from "lucide-react";

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export function DashboardStats() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
    >
      <StatsCard
        title="Total Usuários"
        value="156"
        trend="+12"
        trendUp={true}
        icon={Users}
        color="text-[#A3D154]"
        bg="bg-[#A3D154]/10"
      />
      <StatsCard
        title="Ativos Agora"
        value="24"
        trend="Estável"
        trendUp={true}
        icon={UserCheck}
        color="text-emerald-500"
        bg="bg-emerald-500/10"
      />
      <StatsCard
        title="Administradores"
        value="8"
        icon={Shield}
        color="text-indigo-500"
        bg="bg-indigo-500/10"
      />
      <StatsCard
        title="Sessões (24h)"
        value="342"
        trend="+5%"
        trendUp={true}
        icon={Clock}
        color="text-orange-500"
        bg="bg-orange-500/10"
      />
    </motion.div>
  );
}
