
const { getDb, planoAula, sql } = require("./packages/db/dist/index.js");

async function main() {
    console.log("Iniciando remoção de TODOS os planos de aula (JS Script - Internal Imports)...");

    try {
        const db = getDb();

        // Count before
        const countBeforeResult = await db.select({ count: sql`count(*)` }).from(planoAula);
        const countBefore = Number(countBeforeResult[0]?.count || 0);
        console.log(`Planos encontrados antes da remoção: ${countBefore}`);

        if (countBefore === 0) {
            console.log("Nenhum plano para remover.");
            process.exit(0);
        }

        // Delete all
        await db.delete(planoAula);

        // Count after
        const countAfterResult = await db.select({ count: sql`count(*)` }).from(planoAula);
        const countAfter = Number(countAfterResult[0]?.count || 0);
        console.log(`Planos restantes após remoção: ${countAfter}`);

        if (countAfter === 0) {
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
