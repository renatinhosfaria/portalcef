# Regressão do retorno ao mapa

O teste usa navegação real do Next.js e uma API simulada em `127.0.0.1:4032`. A vitrine roda em `127.0.0.1:3024`. Não usa banco, credenciais nem pedidos de produção. As duas portas precisam estar livres.

Executar em computador e celular durante o desenvolvimento:

```bash
pnpm exec playwright test --config apps/eventos/playwright.config.ts
```

Validar o mesmo cenário no build de produção:

```bash
pnpm --filter @essencia/eventos build
EVENTOS_E2E_PRODUCAO=1 pnpm exec playwright test --config apps/eventos/playwright.config.ts
```

O cenário reserva um combo, usa Voltar e Avançar, retoma o mesmo pedido e libera para edição. Confere a preservação dos dez lugares, o grupo do pacote e a ausência de outra chamada de reserva.
