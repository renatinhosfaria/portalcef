"use client";

import { motion } from "framer-motion";
import { Landmark, School, Users2 } from "lucide-react";

import { StatsCard } from "../stats/stats-card";

interface OverviewGridProps {
  schoolsCount: number;
  unitsCount: number;
  directorsCount: number;
}

const stagger = {
  visible: { transition: { staggerChildren: 0.1 } },
};

export function OverviewGrid({
  schoolsCount,
  unitsCount,
  directorsCount,
}: OverviewGridProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={stagger}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
    >
      <StatsCard
        title="Escolas Cadastradas"
        value={schoolsCount.toString()}
        icon={Landmark}
        color="text-indigo-600"
        description="Instituições independentes"
      />
      <StatsCard
        title="Total de Unidades"
        value={unitsCount.toString()}
        icon={School}
        color="text-emerald-600"
        description="Filiais ativas"
      />
      <StatsCard
        title="Diretoras Gerais"
        value={directorsCount.toString()}
        icon={Users2}
        color="text-purple-600"
        description="Liderança designada"
      />
    </motion.div>
  );
}
