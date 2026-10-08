# Correções do módulo Eventos — Plano de Implementação

> **Para o agente:** executar tarefa por tarefa, mantendo o ciclo RED-GREEN-REFACTOR.

**Objetivo:** Corrigir os problemas operacionais mais importantes do módulo Eventos sem alterar regras de segurança.

**Arquitetura:** O cadastro será atômico no serviço da API. A configuração do evento ficará centralizada na API e será exposta pelo endpoint de status, evitando que eventos encerrados continuem aceitando inscrições. A tela administrativa passará a paginar a lista, exportar o conjunto completo filtrado e restaurar o último sorteio ao abrir.

**Tecnologias:** NestJS, Drizzle, Zod, Next.js App Router, React, Vitest e Jest.

---

### Tarefa 1: Corrigir atomicidade do cadastro

**Arquivos:**
- Modificar: `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.spec.ts`
- Modificar: `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.ts`

1. Adicionar teste que simule falha ao inserir filhos e confirme que o serviço usa uma única transação.
2. Executar o teste e confirmar a falha.
3. Mover inserção da inscrição e dos filhos para `db.transaction`, usando somente o objeto transacional.
4. Converter esgotamento de tentativas de número em `ServiceUnavailableException`.
5. Executar os testes do serviço e confirmar sucesso.

### Tarefa 2: Centralizar ciclo de vida e metadados do evento

**Arquivos:**
- Criar: `services/api/src/modules/evento-inscricoes/evento-config.ts`
- Modificar: `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.spec.ts`
- Modificar: `services/api/src/modules/evento-inscricoes/evento-inscricoes.service.ts`
- Modificar: `services/api/src/modules/evento-inscricoes/evento-inscricoes.controller.ts`

1. Testar que o status do evento conhecido retorna título, local, horário e encerramento, e que slug desconhecido retorna `NotFoundException`.
2. Testar que uma inscrição após o encerramento é rejeitada.
3. Implementar configuração central do evento atual, com encerramento em 16/05/2026 às 9h30 no fuso de Brasília.
4. Fazer `obterStatus` retornar os metadados e validar o evento antes do cadastro.
5. Executar testes focados da API.

### Tarefa 3: Paginação e exportação completa na tela administrativa

**Arquivos:**
- Modificar: `apps/eventos/app/inscricoes-evento/page.tsx`
- Modificar: `apps/eventos/app/page.test.ts`

1. Adicionar teste estático mínimo para os controles de paginação e consulta de exportação completa.
2. Implementar `offset`, navegação anterior/próxima e indicação de página.
3. Implementar carregamento de todas as páginas respeitando os filtros antes de exportar.
4. Exibir erro de exportação via toast e gerar nome de arquivo com a data local de São Paulo.
5. Executar testes e typecheck do app.

### Tarefa 4: Corrigir estado do sorteio e dados exibidos

**Arquivos:**
- Modificar: `apps/eventos/app/inscricoes-evento/page.tsx`
- Modificar: `apps/loja-admin/__tests__/modulo-eventos.test.ts`

1. Adicionar asserções para restauração do último sorteio e dados da ganhadora.
2. Ao carregar o histórico, preencher `ultimoSorteio` com o item mais recente.
3. Exibir nome e telefone no card do último sorteio.
4. Evitar a mensagem de acesso restrito enquanto o tenant ainda carrega.
5. Executar testes do app e do contrato estrutural.

### Tarefa 5: Entregar o número da inscrição e alinhar comunicação do evento

**Arquivos:**
- Modificar: `landing-mae-por-inteiro/inscricao.html`
- Modificar: `landing-mae-por-inteiro/inscricao-convidada.html`
- Modificar: `landing-mae-por-inteiro/confirmacao.html`
- Modificar: `landing-mae-por-inteiro/index.html`
- Modificar: `apps/eventos/app/inscricoes-evento/page.tsx`

1. Fazer o redirecionamento transportar o número retornado pela API.
2. Renderizar o número na confirmação com opção de cópia.
3. Alinhar textos públicos e painel para 9h30 e duração 9h30–12h30, conforme o arquivo ICS.
4. Validar os arquivos com testes de texto e typecheck.

### Tarefa 6: Verificação final

Executar:

```bash
pnpm --filter eventos test -- --run
pnpm --filter eventos typecheck
pnpm --filter eventos lint
pnpm --filter @essencia/api test -- --runInBand src/modules/evento-inscricoes
pnpm --filter @essencia/api typecheck
pnpm --filter @essencia/db typecheck
pnpm --filter @essencia/loja-admin test -- __tests__/modulo-eventos.test.ts
```

Revisar o diff, confirmar que nenhum arquivo fora do escopo foi alterado e registrar limitações restantes, especialmente a regra de brindes repetidos e a ausência de histórico de presença.
