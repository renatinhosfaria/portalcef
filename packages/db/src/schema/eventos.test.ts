import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getTableConfig } from "drizzle-orm/pg-core";

import {
  eventoInventarioAssentos,
  eventoIngressos,
  eventoPedidos,
  eventoSessoes,
  eventoTokensConsulta,
  eventoTiposIngresso,
  eventoAceiteTipoEnum,
  eventoOfertaPricingTypeEnum,
  eventoOfertas,
  eventoAuditoriaAcaoEnum,
  eventoPedidoOrigemEnum,
  eventoParticipantes,
  eventoJuncoesAluna,
  eventos,
} from "./eventos.js";

test("expõe as entidades do módulo e mantém unicidade por sessão", () => {
  assert.ok(eventos);
  assert.ok(eventoSessoes);
  assert.ok(eventoInventarioAssentos);
  assert.ok(eventoPedidos);
  assert.ok(eventoIngressos);
  assert.ok("sessionId" in eventoInventarioAssentos);
  assert.ok("seatId" in eventoInventarioAssentos);
});

test("aceites cobrem todas as politicas publicas", () => {
  assert.deepEqual(eventoAceiteTipoEnum, ["PRIVACIDADE", "COMPRA", "CANCELAMENTO_REEMBOLSO", "ACESSIBILIDADE", "CONTATO"]);
});

test("representa dinheiro em centavos e armazena somente hash do token de consulta", () => {
  assert.ok("priceCents" in eventoTiposIngresso);
  assert.ok("tokenHash" in eventoTokensConsulta);
  assert.equal("tokenPlaintext" in eventoTokensConsulta, false);
});

test("ofertas expõem preço versionado com faixa opcional", () => {
  assert.deepEqual(eventoOfertaPricingTypeEnum, ["PERCENTUAL", "VALOR_FIXO"]);
  assert.ok("pricingType" in eventoOfertas);
  assert.ok("discountPercent" in eventoOfertas);
  assert.equal(eventoOfertas.priceCents.notNull, false);
  assert.equal(eventoOfertas.maxQuantity.notNull, false);

  const checks = getTableConfig(eventoOfertas).checks.map((check) => check.name);
  assert.ok(checks.includes("evento_ofertas_valid_pricing_type"));
  assert.ok(checks.includes("evento_ofertas_valid_discount_percent"));
  assert.ok(checks.includes("evento_ofertas_valid_pricing_values"));
  const activeUniqueIndex = getTableConfig(eventoOfertas).indexes.find((index) => index.config.name === "uq_evento_ofertas_event_active");
  assert.ok(activeUniqueIndex);
  assert.equal(activeUniqueIndex?.config.unique, true);
  assert.ok(activeUniqueIndex?.config.where);
});

test("pedido preserva total legado e detalha subtotal, desconto e oferta aplicada", () => {
  assert.ok("totalCents" in eventoPedidos);
  assert.ok("subtotalCents" in eventoPedidos);
  assert.ok("discountCents" in eventoPedidos);
  assert.ok("appliedOfferId" in eventoPedidos);
  assert.equal(eventoPedidos.subtotalCents.notNull, false);
  assert.equal(eventoPedidos.discountCents.notNull, false);
  assert.equal(eventoPedidos.appliedOfferId.notNull, false);

  const checks = getTableConfig(eventoPedidos).checks.map((check) => check.name);
  assert.ok(checks.includes("evento_pedidos_non_negative_subtotal"));
  assert.ok(checks.includes("evento_pedidos_non_negative_discount"));
});

test("migration saneia ofertas ativas legadas antes do índice parcial", () => {
  const migration = readFileSync(join(__dirname, "../../drizzle/0053_eventos_desconto_volume.sql"), "utf8");
  assert.match(migration, /ROW_NUMBER\(\) OVER/);
  assert.match(migration, /PARTITION BY "event_id"/);
  assert.match(migration, /ORDER BY "version" DESC, "updated_at" DESC, "created_at" DESC, "id" DESC/);
  assert.match(migration, /SET "active" = false/);
  assert.match(migration, /CREATE UNIQUE INDEX "uq_evento_ofertas_event_active"/);
  assert.match(migration, /WHERE "active" = true/);
});

test("permite comprador opcional na reserva", () => {
  const columns = getTableConfig(eventoPedidos).columns;
  assert.equal(columns.find((column) => column.name === "buyer_name")?.notNull, false);
  assert.equal(columns.find((column) => column.name === "buyer_email")?.notNull, false);
  assert.equal(columns.find((column) => column.name === "buyer_phone")?.notNull, false);
});

test("ingresso exige número único", () => {
  const columns = getTableConfig(eventoIngressos).columns;
  assert.equal(columns.find((column) => column.name === "numero")?.notNull, true);
  const numeroUniqueIndex = getTableConfig(eventoIngressos).indexes.find(
    (index) => index.config.name === "uq_evento_ingressos_numero",
  );
  assert.ok(numeroUniqueIndex);
  assert.equal(numeroUniqueIndex?.config.unique, true);
});

test("migration 0054 torna comprador opcional e preenche números correlacionados", () => {
  const migration = readFileSync(join(__dirname, "../../drizzle/0054_eventos_site_publico.sql"), "utf8");
  assert.match(migration, /ALTER COLUMN "buyer_name" DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN "buyer_email" DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN "buyer_phone" DROP NOT NULL/);
  assert.match(migration, /UPDATE "evento_ingressos" AS ingresso SET "numero" = \(/);
  assert.match(migration, /WHERE ingresso\."id" IS NOT NULL/);
  assert.match(migration, /ALTER COLUMN "numero" SET NOT NULL/);
  assert.match(migration, /CREATE UNIQUE INDEX "uq_evento_ingressos_numero"/);
});

test("cortesias: colunas e enums", () => {
  assert.deepEqual([...eventoPedidoOrigemEnum], ["VENDA", "CORTESIA"]);
  assert.equal(eventoPedidos.origin.notNull, true);
  assert.equal(eventoPedidos.origin.default, "VENDA");
  assert.equal(eventoTiposIngresso.internal.notNull, true);
  assert.equal(eventoTiposIngresso.internal.default, false);
  assert.ok(eventoAuditoriaAcaoEnum.includes("CORTESIA_EMITIDA"));
  assert.ok(eventoAuditoriaAcaoEnum.includes("CORTESIA_CANCELADA"));
});

test("aluna que convidou: coluna opcional no participante e junções únicas por evento", () => {
  const coluna = getTableConfig(eventoParticipantes).columns.find((column) => column.name === "student_name");
  assert.ok(coluna);
  assert.equal(coluna?.notNull, false);

  const juncoes = getTableConfig(eventoJuncoesAluna);
  assert.equal(juncoes.name, "evento_juncoes_aluna");
  assert.deepEqual(
    juncoes.columns.filter((column) => column.notNull).map((column) => column.name).sort(),
    ["created_at", "event_id", "id", "source_key", "target_key", "updated_at"],
  );
  const unico = juncoes.indexes.find((index) => index.config.name === "uq_evento_juncoes_aluna_event_source");
  assert.equal(unico?.config.unique, true);
});

test("migration 0056 cria a coluna da aluna e a tabela de junções", () => {
  const migration = readFileSync(join(__dirname, "../../drizzle/0056_eventos_aluna_convidou.sql"), "utf8");
  assert.match(migration, /ALTER TABLE "evento_participantes" ADD COLUMN "student_name" varchar\(200\)/);
  assert.match(migration, /CREATE TABLE "evento_juncoes_aluna"/);
  assert.match(migration, /CREATE UNIQUE INDEX "uq_evento_juncoes_aluna_event_source"/);
  const journal = JSON.parse(readFileSync(join(__dirname, "../../drizzle/meta/_journal.json"), "utf8"));
  assert.equal(journal.entries.at(-1).tag, "0056_eventos_aluna_convidou");
});
