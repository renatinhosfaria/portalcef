import { serverApi } from "@essencia/shared/fetchers/server";
import { cookies } from "next/headers";

import { OverviewGrid } from "../components/overview/overview-grid";

export const dynamic = "force-dynamic";

interface MasterOverviewStats {
  schoolsCount: number;
  unitsCount: number;
  directorsCount: number;
  studentsCount: number;
}

export default async function Page() {
  const cookieStore = cookies();
  const cookieHeader = cookieStore.toString();

  // Fetch stats from API (governed data access)
  const stats = await serverApi.get<MasterOverviewStats>(
    "/api/stats/master-overview",
    { cookies: cookieHeader },
  );

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">
          Visão Geral
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl text-balance">
          Bem-vindo ao painel Master. Aqui você tem o controle global de todas
          as instituições e unidades da rede Essência.
        </p>
      </div>

      <OverviewGrid
        schoolsCount={stats.schoolsCount}
        unitsCount={stats.unitsCount}
        directorsCount={stats.directorsCount}
        studentsCount={stats.studentsCount}
      />

      <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl shadow-slate-900/10">
        <div className="max-w-xl">
          <h3 className="text-2xl font-bold mb-2">Próximos Passos</h3>
          <p className="text-slate-300 mb-6">
            Comece gerenciando o cadastro das instituições de ensino para
            expandir a rede.
          </p>
        </div>
      </div>
    </div>
  );
}
