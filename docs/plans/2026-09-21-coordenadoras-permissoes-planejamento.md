# Coordenadoras com as funções da gerente de unidade — Plano de Implementação

> **Para Codex:** executar este plano seguindo TDD e validar cada etapa antes de declarar a tarefa concluída.

**Objetivo:** permitir que todas as roles de coordenadora usem a mesma superfície de gestão do módulo `planejamento` que `gerente_unidade`, sempre limitadas à unidade da sessão.

**Arquitetura:** alinhar a fonte de verdade de roles da API (`plano-aula.dto.ts`) e os helpers de permissão do app. As rotas de planos, provas, períodos, ciclos e relatórios/semestres receberão as coordenadoras onde a gerente de unidade já é aceita; as validações por etapa serão removidas apenas da gestão do planejamento, preservando o isolamento por unidade.

**Stack:** NestJS, Jest, Next.js, Vitest, TypeScript, Turborepo.

---

### Etapa 1: Fixar a política com testes falhando

- Atualizar os testes dos helpers da API e do app para exigir que todas as coordenadoras sejam gestão global do planejamento.
- Atualizar testes de metadados dos controllers para exigir acesso de coordenadora às rotas de exclusão e configuração.
- Executar os testes focados e confirmar falhas causadas pela política atual.

### Etapa 2: Alinhar a autorização da API

- Incluir todas as coordenadoras em `GESTAO_ROLES` compartilhado por planos e provas.
- Permitir coordenadoras nas rotas e serviços de listagem/exclusão gerencial.
- Fazer períodos, ciclos e semestres aceitarem todas as coordenadoras em todas as etapas disponíveis.
- Alinhar o módulo de relatórios à mesma lista de coordenadoras.

### Etapa 3: Alinhar a interface e helpers

- Fazer `isGestao`, `getUserSegment` e listas de permissões do app refletirem acesso global da unidade para coordenadoras.
- Mostrar todas as etapas disponíveis nas telas de configuração para coordenadoras.

### Etapa 4: Validar

- Rodar testes focados da API e do app.
- Rodar `pnpm turbo lint && pnpm turbo typecheck`.
- Conferir o diff para garantir que apenas o planejamento e o documento deste plano foram alterados; manter intactas as alterações pré-existentes.
