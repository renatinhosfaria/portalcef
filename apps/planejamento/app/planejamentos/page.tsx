import { LayoutDashboard, Umbrella } from "lucide-react";
import type { Metadata } from "next";

import {
  generateMockQuinzenas,
  isInVacationPeriod,
  QuinzenasGrid,
} from "../../features/planejamentos";

export const metadata: Metadata = {
  title: "Meus Planejamentos | Essência",
  description: "Gerencie seus planejamentos quinzenais.",
};

export default function PlanejamentosPage() {
  const quinzenas = generateMockQuinzenas();
  const isVacation = isInVacationPeriod(new Date());

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <LayoutDashboard className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Painel de Planejamentos
          </h1>
        </div>
        <p className="text-muted-foreground">
          Acompanhe seus prazos e entregas de planejamentos quinzenais.
        </p>
      </div>

      {/* Banner de Férias */}
      {isVacation && (
        <div className="mb-8 p-4 rounded-lg bg-blue-50 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100">
              <Umbrella className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-blue-900">
                🏖️ Período de Férias Escolares
              </h2>
              <p className="text-sm text-blue-700">
                Aproveite as férias de julho (01/07 - 31/07)! As quinzenas do 2º
                semestre começam em 03/08/2026.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Grid de Quinzenas */}
      <QuinzenasGrid quinzenas={quinzenas} />
    </div>
  );
}
