# Relatório da Tarefa 3 — Shell do workspace e navegação lateral

## Entrega

- Criado `WorkspaceShell` com cabeçalho Portal CEF, status do evento, estado do salvamento, pendência acionável e área de conteúdo.
- Criado `WorkspaceStatus` com os estados `idle`, `saving`, `saved`, `error` e `conflict`.
- Criada navegação lateral persistente para as seis etapas: Informações, Sessões e local, Mapa e lugares, Ingressos, Políticas e Revisar e publicar.
- Integrado o shell ao layout dinâmico de `/eventos/[id]`; a página de detalhe passou a ser conteúdo inicial da etapa.
- Adicionado foco visível para teclado e identidade visual Portal CEF no CSS.

## Verificação

- `pnpm --filter @essencia/eventos-admin test -- workspace-shell.test.tsx`: PASS (2 testes).
- `pnpm --filter @essencia/eventos-admin test`: PASS (8 arquivos, 17 testes).
- `pnpm --filter @essencia/eventos-admin typecheck`: PASS.
- `git diff --check`: PASS.

## Observações

O layout usa um estado inicial `RASCUNHO` sem consulta de prontidão; o carregamento da prontidão e os estados reais de cada etapa serão conectados nas tarefas posteriores.
