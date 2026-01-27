
import { getDb, planoAula, plannings } from "@essencia/db";
import { sql } from "drizzle-orm";

/**
 * Script utilitário para remover TODOS os planos de aula do banco de dados.
 * 
 * Uso:
 * DATABASE_URL=postgresql://user:pass@host:5432/db npx tsx scripts/delete-all-plannings.ts
 */
async function main() {
    console.log("Iniciando remoção de TODOS os planos de aula (Tabelas: plano_aula e plannings)...");

    if (!process.env.DATABASE_URL) {
        console.error("ERRO: DATABASE_URL não definida.");
        console.error("Exemplo: DATABASE_URL=postgresql://user:pass@host:5432/db npx tsx scripts/delete-all-plannings.ts");
        process.exit(1);
    }

    const db = getDb();

    try {
        // Count before - planoAula
        const countBeforePlanoAulaResult = await db.select({ count: sql<number>`count(*)` }).from(planoAula);
        const countBeforePlanoAula = Number(countBeforePlanoAulaResult[0]?.count || 0);
        console.log(`Planos (plano_aula) encontrados antes da remoção: ${countBeforePlanoAula}`);

        // Count before - plannings
        const countBeforePlanningsResult = await db.select({ count: sql<number>`count(*)` }).from(plannings);
        const countBeforePlannings = Number(countBeforePlanningsResult[0]?.count || 0);
        console.log(`Planos (plannings) encontrados antes da remoção: ${countBeforePlannings}`);

        if (countBeforePlanoAula === 0 && countBeforePlannings === 0) {
            console.log("Nenhum plano para remover em nenhuma das tabelas.");
            process.exit(0);
        }

        // Delete all fro planoAula
        if (countBeforePlanoAula > 0) {
            console.log("Removendo registros de plano_aula...");
            await db.delete(planoAula);
        }

        // Delete all from plannings
        if (countBeforePlannings > 0) {
            console.log("Removendo registros de plannings...");
            await db.delete(plannings);
        }

        // Count after - planoAula
        const countAfterPlanoAulaResult = await db.select({ count: sql<number>`count(*)` }).from(planoAula);
        const countAfterPlanoAula = Number(countAfterPlanoAulaResult[0]?.count || 0);

        // Count after - plannings
        const countAfterPlanningsResult = await db.select({ count: sql<number>`count(*)` }).from(plannings);
        const countAfterPlannings = Number(countAfterPlanningsResult[0]?.count || 0);

        console.log(`Planos (plano_aula) restantes após remoção: ${countAfterPlanoAula}`);
        console.log(`Planos (plannings) restantes após remoção: ${countAfterPlannings}`);

        if (countAfterPlanoAula === 0 && countAfterPlannings === 0) {
            console.log("SUCESSO: Todos os planos foram removidos.");
        } else {
            console.error("ERRO: Ainda existem planos no banco de dados.");
            process.exit(1);
        }
    } catch (error) {
        console.error("Erro ao remover planos:", error);
        process.exit(1);
    }
}

main();
