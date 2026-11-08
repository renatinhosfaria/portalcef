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
