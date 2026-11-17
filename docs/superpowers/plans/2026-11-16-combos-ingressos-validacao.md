# Validação dos combos de ingressos

Plano executado: [2026-11-16-combos-ingressos.md](2026-11-16-combos-ingressos.md).
Base: `6c133607d5f478304db9ce5c88da3a5e3a4bacec`.
Branch: `codex/combos-ingressos`.

## Resultado

Quantidade configurável por tipo; compra de pacotes completos e avulsos; preço total por pacote com rateio exato; um ingresso e QR Code por assento. Removido teto global por pedido, mantendo apenas limites opcionais configurados por tipo em lugares. Retomada e edição preservam os grupos e a composição histórica.

## Revisão independente

Um revisor independente analisou a branch completa contra spec e plano. Encontrou dois problemas importantes: retorno ao mapa podia apagar o rascunho dos lugares da própria reserva; perda integral de um pacote podia permitir continuar com a seleção reduzida sem aviso. Ambos foram reproduzidos por testes que falharam antes da correção.

O passe de correção passou a consultar a reserva indicada na URL e conferir sessão, composição, status e validade antes de retomá-la. Permite continuar a mesma compra ou salvar a seleção antes de liberar para edição. Perdas exigem revisão explícita, mantendo o rascunho original até a confirmação. Também cobre sessão lotada, armazenamento indisponível, pedido de outra composição e falha do mapa depois da liberação. Não houve segunda rodada de revisão; as correções foram verificadas por regressões e suítes completas. Nenhum achado menor foi adiado.

## Evidências

| Escopo | Resultado |
| --- | --- |
| Site de eventos, após correções | 26 arquivos, 204 testes aprovados |
| API, conjunto sem as duas suítes PDF | 114 suítes, 1.348 testes aprovados |
| API, leitura de PDF isolada | 1 suíte, 11 testes aprovados |
| API, proposta de mapa PDF isolada | 1 suíte, 8 testes aprovados |
| API, cobertura total somada | 116 suítes, 1.367 testes aprovados |
| Banco | 19 testes aprovados |
| Shared | 15 arquivos, 96 testes aprovados |
| Administração | 47 arquivos, 237 testes aprovados |
| Lint global | 21 tarefas aprovadas, avisos preexistentes |
| Typecheck global | 22 tarefas aprovadas |

Banco, shared e administração foram verificados antes da revisão e não sofreram alterações posteriores. A primeira execução conjunta da API passou; outra execução falhou no carregamento ESM do PDF com `Test environment has been torn down`, também observado na linha de base. A verificação final separou as duas suítes PDF em processos próprios e cobriu todos os testes; não demonstra estabilidade da execução conjunta.

Comandos finais:

```bash
pnpm --filter @essencia/eventos run test
pnpm --filter @essencia/api run test --runInBand --testPathIgnorePatterns 'mapas/gerador/(ler-planta-pdf|gerar-proposta).spec.ts'
pnpm --filter @essencia/api run test --runInBand --runTestsByPath src/modules/eventos/mapas/gerador/ler-planta-pdf.spec.ts
pnpm --filter @essencia/api run test --runInBand --runTestsByPath src/modules/eventos/mapas/gerador/gerar-proposta.spec.ts
pnpm turbo lint --concurrency=2
pnpm turbo typecheck --concurrency=2
```

## Decisões durante a execução e custos possíveis

1. Usar worktree própria para preservar main e produção. Custo: integração posterior separada.
2. Extrair os títulos portugueses do plano com adaptação local do extrator. Custo: não reutilizar diretamente o extrator que exige Task em inglês.
3. Usar `pnpm ... run test` para encaminhar flags ao Jest. Custo: comandos sem `run` podem verificar outro escopo.
4. Testar presença da migration 0058 no journal, preservando a possibilidade de migrations novas. Custo: o teste deixa de exigir que 0058 seja a última.
5. Reduzir concorrência do pipeline a 2 após saída 137, mantendo todas as tarefas. Custo: execução mais lenta.
6. Manter o método real `criarEvento`, divergente do exemplo do plano. Custo: exemplos do plano não são transcrição literal.
7. Preservar ID no autosave para editar o mesmo tipo. Custo se incorreto: atualizações poderiam atingir o tipo errado; testes verificam a identidade.
8. Corrigir IDs incompatíveis nas fixtures antigas, mantendo validação estrita. Custo se incorreto: fixtures poderiam esconder uma incompatibilidade; os casos negativos continuam cobertos.
9. Manter recálculo correto de cupons e acrescentar caracterização, sem fabricar mudança para obter RED. Corrigir fixture para respeitar o predicado de update. Custo: esses casos documentam comportamento já existente.
10. Renovar identidade após liberação, usar retorno curto também na expiração e reclassificar grupos incompatíveis com cadastro atual. Custo: edição após liberação usa as regras atuais e pode exigir nova escolha.
11. Declarar Zod diretamente no site na faixa já usada pelo monorepo. Custo: uma dependência explícita adicional.
12. Colocar o fluxo integrado em fixture de fronteira transacional e arquivos próprios. Custo: não substitui teste em banco real nem operação de produção.
13. Corrigir gravação no rascunho antigo quando muda a referência na mesma página. Custo: maior coordenação de estado de restauração, coberta por regressão.
14. Preservar teste original de mapeamento e acrescentar testes históricos ao arquivo existente. Custo: o plano dizia criar arquivo, mas ele já existia.
15. Não afirmar consumo operacional de QR: a portaria existente é provisória. Custo: leitura real exigirá implementação e validação próprias.
16. Manter deploy e migration em produção fora desta etapa aprovada. Custo: recurso só estará disponível após publicação e configuração explícita do combo com quantidade 10.
17. Isolar suítes PDF para verificar toda a API sem alterar código não relacionado. Custo: a execução conjunta permanece sujeita à falha preexistente do ambiente Jest.

## Publicação futura

Não foi feito deploy nem aplicada migration em produção. A migration mantém tipos existentes como avulsos (`lugaresPorPacote = 1`); o nome “Combo 10 ingressos” não converte automaticamente o tipo. Depois da publicação autorizada, configurar explicitamente quantidade 10 e preço total do pacote. Seguir `./scripts/deploy.sh --migrar` na etapa de produção.
