// eslint-disable-next-line no-restricted-imports
import { eq, getDb, schema } from "@essencia/db";

import { OverviewGrid } from "../components/overview/overview-grid";

export const dynamic = "force-dynamic";

export default async function Page() {
  const db = getDb();

  const schools = await db.select().from(schema.schools);
  const units = await db.select().from(schema.units);
  const directors = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, "diretora_geral"));

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
        schoolsCount={schools.length}
        unitsCount={units.length}
        directorsCount={directors.length}
        studentsCount={0}
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
