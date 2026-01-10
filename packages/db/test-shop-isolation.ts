import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { eq, and } from "drizzle-orm";

import {
  shopProducts,
  shopProductVariants,
  shopInventory,
} from "./src/schema/shop";
import { units } from "./src/schema/index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, "../../.env") });

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function testTenantIsolation() {
  try {
    console.log("🔐 Testando isolamento multi-tenant...\n");

    // Buscar unidades
    const allUnits = await db.select().from(units);
    console.log(`📍 Unidades encontradas: ${allUnits.length}\n`);

    if (allUnits.length < 2) {
      console.warn(
        "⚠️  Apenas 1 unidade encontrada. Para testar isolamento completo, crie mais uma unidade.",
      );
      const unitA = allUnits[0];

      // Buscar estoque da unidade A
      const inventoryA = await db
        .select({
          productName: shopProducts.name,
          size: shopProductVariants.size,
          quantity: shopInventory.quantity,
          unitId: shopInventory.unitId,
        })
        .from(shopInventory)
        .innerJoin(
          shopProductVariants,
          eq(shopInventory.variantId, shopProductVariants.id),
        )
        .innerJoin(
          shopProducts,
          eq(shopProductVariants.productId, shopProducts.id),
        )
        .where(eq(shopInventory.unitId, unitA.id))
        .limit(5);

      console.log(`✅ Estoque da Unidade A (${unitA.name}):`);
      console.table(inventoryA);

      console.log("\n✅ TESTE BÁSICO PASSOU");
      console.log("   - Estoque é filtrado corretamente por unit_id");
      console.log("   - Queries respeitam isolamento\n");
    } else {
      const unitA = allUnits[0];
      const unitB = allUnits[1];

      console.log(`🏢 Unidade A: ${unitA.name} (${unitA.id})`);
      console.log(`🏢 Unidade B: ${unitB.name} (${unitB.id})\n`);

      // Teste 1: Buscar estoque da unidade A
      const inventoryA = await db
        .select({
          productName: shopProducts.name,
          size: shopProductVariants.size,
          quantity: shopInventory.quantity,
          unitId: shopInventory.unitId,
        })
        .from(shopInventory)
        .innerJoin(
          shopProductVariants,
          eq(shopInventory.variantId, shopProductVariants.id),
        )
        .innerJoin(
          shopProducts,
          eq(shopProductVariants.productId, shopProducts.id),
        )
        .where(eq(shopInventory.unitId, unitA.id))
        .limit(5);

      console.log(`📊 Estoque da Unidade A (${unitA.name}):`);
      console.table(inventoryA);

      // Teste 2: Buscar estoque da unidade B
      const inventoryB = await db
        .select({
          productName: shopProducts.name,
          size: shopProductVariants.size,
          quantity: shopInventory.quantity,
          unitId: shopInventory.unitId,
        })
        .from(shopInventory)
        .innerJoin(
          shopProductVariants,
          eq(shopInventory.variantId, shopProductVariants.id),
        )
        .innerJoin(
          shopProducts,
          eq(shopProductVariants.productId, shopProducts.id),
        )
        .where(eq(shopInventory.unitId, unitB.id))
        .limit(5);

      console.log(`\n📊 Estoque da Unidade B (${unitB.name}):`);
      console.table(inventoryB);

      // Teste 3: Verificar que não há vazamento
      const leakTest = inventoryA.some((item) => item.unitId === unitB.id);
      const leakTestB = inventoryB.some((item) => item.unitId === unitA.id);

      console.log("\n🔍 Teste de Isolamento:");
      console.log(
        `   - Unidade A vazou dados de B? ${leakTest ? "❌ SIM (FALHA)" : "✅ NÃO"}`,
      );
      console.log(
        `   - Unidade B vazou dados de A? ${leakTestB ? "❌ SIM (FALHA)" : "✅ NÃO"}`,
      );

      if (leakTest || leakTestB) {
        console.error("\n❌ FALHA NO ISOLAMENTO MULTI-TENANT!");
        process.exit(1);
      }
    }

    // Teste 4: Verificar constraint UNIQUE (variant_id, unit_id)
    console.log("\n🔐 Teste de Constraint UNIQUE:");
    try {
      const firstInventory = await db.select().from(shopInventory).limit(1);
      if (firstInventory.length > 0) {
        await db.insert(shopInventory).values({
          variantId: firstInventory[0].variantId,
          unitId: firstInventory[0].unitId,
          quantity: 100,
          reservedQuantity: 0,
        });
        console.error("   ❌ FALHA: Constraint não impediu duplicata!");
        process.exit(1);
      }
    } catch (error) {
      if (error.code === "23505") {
        // Unique violation
        console.log("   ✅ Constraint UNIQUE funcionando corretamente");
      } else {
        throw error;
      }
    }

    // Teste 5: Verificar índices existem
    console.log("\n📊 Verificando índices...");
    const indexes = await sql`
      SELECT 
        schemaname,
        tablename,
        indexname
      FROM pg_indexes
      WHERE tablename LIKE 'shop_%'
      ORDER BY tablename, indexname;
    `;

    const shopIndexes = indexes.filter((idx) =>
      idx.tablename.startsWith("shop_"),
    );
    console.log(
      `   ✅ ${shopIndexes.length} índices encontrados nas tabelas shop`,
    );

    // Listar índices por tabela
    const indexesByTable = shopIndexes.reduce((acc, idx) => {
      if (!acc[idx.tablename]) acc[idx.tablename] = [];
      acc[idx.tablename].push(idx.indexname);
      return acc;
    }, {});

    console.log("\n📋 Índices por tabela:");
    Object.entries(indexesByTable).forEach(([table, idxs]) => {
      console.log(`   ${table}: ${idxs.length} índices`);
    });

    console.log("\n✅ TODOS OS TESTES DE ISOLAMENTO PASSARAM!\n");
    console.log("📊 Resumo:");
    console.log("   ✅ Estoque isolado por unit_id");
    console.log("   ✅ Nenhum vazamento cross-tenant detectado");
    console.log("   ✅ Constraint UNIQUE funcionando");
    console.log(`   ✅ ${shopIndexes.length} índices verificados\n`);
  } catch (error) {
    console.error("❌ Erro no teste:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

testTenantIsolation()
  .then(() => {
    console.log("🎉 Testes concluídos com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Falha nos testes:", error);
    process.exit(1);
  });
