import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "dotenv";

import { join } from "path";
import { eq } from "drizzle-orm";

import {
  shopProducts,
  shopProductVariants,
  shopInventory,
  shopSettings,
} from "../src/schema/shop.js";
import { schools, units } from "../src/schema/index.js";



// Load environment variables
config({ path: join(__dirname, "../../../.env") });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ DATABASE_URL não definida no .env");
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });
const db = drizzle(sql);

async function seedShopData() {
  try {
    console.log("🌱 Iniciando seed do módulo shop...\n");

    // Buscar primeira escola e unidades
    const allSchools = await db.select().from(schools).limit(1);
    if (allSchools.length === 0) {
      console.error(
        "❌ Nenhuma escola encontrada. Execute o seed básico primeiro.",
      );
      process.exit(1);
    }
    const school = allSchools[0];
    console.log(`📚 Usando escola: ${school.name} (${school.id})`);

    const allUnits = await db
      .select()
      .from(units)
      .where(eq(units.schoolId, school.id))
      .limit(2);
    if (allUnits.length === 0) {
      console.error("❌ Nenhuma unidade encontrada para essa escola.");
      process.exit(1);
    }
    console.log(`🏢 Unidades encontradas: ${allUnits.length}\n`);

    // 1. Criar produtos
    console.log("📦 Criando produtos...\n");

    const camisetaDiaria = await db
      .insert(shopProducts)
      .values({
        schoolId: school.id,
        name: "Camiseta Uniforme Diário",
        description: "Camiseta polo branca com logotipo da escola bordado",
        basePrice: 4500, // R$ 45,00
        category: "UNIFORME_MASCULINO",
        isActive: true,
      })
      .returning();
    console.log(`✅ Criado: ${camisetaDiaria[0].name}`);

    const bermudaDiaria = await db
      .insert(shopProducts)
      .values({
        schoolId: school.id,
        name: "Bermuda Uniforme Diário",
        description: "Bermuda azul marinho em tactel",
        basePrice: 5500, // R$ 55,00
        category: "UNIFORME_FEMININO",
        isActive: true,
      })
      .returning();
    console.log(`✅ Criado: ${bermudaDiaria[0].name}`);

    const camisetaEF = await db
      .insert(shopProducts)
      .values({
        schoolId: school.id,
        name: "Camiseta Educação Física",
        description: "Camiseta dry-fit amarela para aulas de educação física",
        basePrice: 4000, // R$ 40,00
        category: "UNIFORME_FEMININO",
        isActive: true,
      })
      .returning();
    console.log(`✅ Criado: ${camisetaEF[0].name}`);

    const shortEF = await db
      .insert(shopProducts)
      .values({
        schoolId: school.id,
        name: "Short Educação Física",
        description: "Short azul royal em tactel para educação física",
        basePrice: 4500, // R$ 45,00
        category: "UNIFORME_MASCULINO",
        isActive: true,
      })
      .returning();
    console.log(`✅ Criado: ${shortEF[0].name}`);

    const mochila = await db
      .insert(shopProducts)
      .values({
        schoolId: school.id,
        name: "Mochila Escolar",
        description: "Mochila de costas com compartimento para notebook",
        basePrice: 12000, // R$ 120,00
        category: "ACESSORIO",
        isActive: true,
      })
      .returning();
    console.log(`✅ Criado: ${mochila[0].name}`);

    const estojo = await db
      .insert(shopProducts)
      .values({
        schoolId: school.id,
        name: "Estojo Duplo",
        description: "Estojo com dois compartimentos",
        basePrice: 3500, // R$ 35,00
        category: "ACESSORIO",
        isActive: true,
      })
      .returning();
    console.log(`✅ Criado: ${estojo[0].name}\n`);

    // 2. Criar variantes (tamanhos)
    console.log("📏 Criando variantes (tamanhos)...\n");

    const tamanhosCriancas = ["2", "4", "6", "8", "10", "12", "14", "16"];
    const tamanhosAdultos = ["PP", "P", "M", "G", "GG"];
    const tamanhoUnico = ["ÚNICO"];

    // Camiseta diária (tamanhos infantis)
    const variantsCamisetaDiaria = [];
    for (const size of tamanhosCriancas) {
      const variant = await db
        .insert(shopProductVariants)
        .values({
          productId: camisetaDiaria[0].id,
          size,
          sku: `CAM-DIARIA-${size}`,
          isActive: true,
        })
        .returning();
      variantsCamisetaDiaria.push(variant[0]);
    }
    console.log(
      `✅ ${variantsCamisetaDiaria.length} variantes criadas para Camiseta Diária`,
    );

    // Bermuda diária
    const variantsBermudaDiaria = [];
    for (const size of tamanhosCriancas) {
      const variant = await db
        .insert(shopProductVariants)
        .values({
          productId: bermudaDiaria[0].id,
          size,
          sku: `BER-DIARIA-${size}`,
          isActive: true,
        })
        .returning();
      variantsBermudaDiaria.push(variant[0]);
    }
    console.log(
      `✅ ${variantsBermudaDiaria.length} variantes criadas para Bermuda Diária`,
    );

    // Camiseta EF
    const variantsCamisetaEF = [];
    for (const size of tamanhosCriancas) {
      const variant = await db
        .insert(shopProductVariants)
        .values({
          productId: camisetaEF[0].id,
          size,
          sku: `CAM-EF-${size}`,
          isActive: true,
        })
        .returning();
      variantsCamisetaEF.push(variant[0]);
    }
    console.log(
      `✅ ${variantsCamisetaEF.length} variantes criadas para Camiseta EF`,
    );

    // Short EF
    const variantsShortEF = [];
    for (const size of tamanhosCriancas) {
      const variant = await db
        .insert(shopProductVariants)
        .values({
          productId: shortEF[0].id,
          size,
          sku: `SHORT-EF-${size}`,
          isActive: true,
        })
        .returning();
      variantsShortEF.push(variant[0]);
    }
    console.log(`✅ ${variantsShortEF.length} variantes criadas para Short EF`);

    // Mochila (tamanho único)
    const variantsMochila = [];
    for (const size of tamanhoUnico) {
      const variant = await db
        .insert(shopProductVariants)
        .values({
          productId: mochila[0].id,
          size,
          sku: `MOCHILA-${size}`,
          isActive: true,
        })
        .returning();
      variantsMochila.push(variant[0]);
    }
    console.log(`✅ ${variantsMochila.length} variante criada para Mochila`);

    // Estojo (tamanho único)
    const variantsEstojo = [];
    for (const size of tamanhoUnico) {
      const variant = await db
        .insert(shopProductVariants)
        .values({
          productId: estojo[0].id,
          size,
          sku: `ESTOJO-${size}`,
          isActive: true,
        })
        .returning();
      variantsEstojo.push(variant[0]);
    }
    console.log(`✅ ${variantsEstojo.length} variante criada para Estojo\n`);

    // 3. Criar estoque para cada unidade
    console.log("📊 Criando estoque para as unidades...\n");

    const allVariants = [
      ...variantsCamisetaDiaria,
      ...variantsBermudaDiaria,
      ...variantsCamisetaEF,
      ...variantsShortEF,
      ...variantsMochila,
      ...variantsEstojo,
    ];

    let inventoryCount = 0;
    for (const unit of allUnits) {
      for (const variant of allVariants) {
        // Quantidade aleatória entre 5 e 50 para variar o estoque
        const quantity = Math.floor(Math.random() * 46) + 5;
        await db.insert(shopInventory).values({
          variantId: variant.id,
          unitId: unit.id,
          quantity,
          reservedQuantity: 0,
          lowStockThreshold: 5,
        });
        inventoryCount++;
      }
      console.log(
        `✅ Estoque criado para unidade: ${unit.name} (${allVariants.length} itens)`,
      );
    }
    console.log(`\n📦 Total: ${inventoryCount} entradas de estoque criadas\n`);

    // 4. Criar configurações padrão para cada unidade
    console.log("⚙️  Criando configurações da loja...\n");

    for (const unit of allUnits) {
      await db.insert(shopSettings).values({
        unitId: unit.id,
        maxInstallments: 3,
        isShopEnabled: true,
        pickupInstructions: `Retirar na secretaria da ${unit.name} de segunda a sexta, das 7h às 17h. Apresentar este código ou o telefone cadastrado.`,
      });
      console.log(`✅ Configurações criadas para: ${unit.name}`);
    }

    console.log("\n✅ Seed do módulo shop concluído com sucesso!\n");
    console.log("📊 Resumo:");
    console.log(`  - ${6} produtos criados`);
    console.log(`  - ${allVariants.length} variantes criadas`);
    console.log(`  - ${inventoryCount} entradas de estoque`);
    console.log(`  - ${allUnits.length} configurações de unidade\n`);
  } catch (error) {
    console.error("❌ Erro ao aplicar seed:", error);
    throw error;
  } finally {
    await sql.end();
  }
}

seedShopData()
  .then(() => {
    console.log("🎉 Processo concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Falha no seed:", error);
    process.exit(1);
  });
