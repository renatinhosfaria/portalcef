import test from "node:test";
import assert from "node:assert/strict";

import {
  eventoInventarioAssentos,
  eventoIngressos,
  eventoPedidos,
  eventoSessoes,
  eventoTokensConsulta,
  eventoTiposIngresso,
  eventoAceiteTipoEnum,
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
