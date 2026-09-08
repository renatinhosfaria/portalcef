# Design: exclusão justificada de arquivos do planejamento

**Data:** 2026-09-08
**Módulo:** planejamento
**Status:** Validado para implementação

## Objetivo

Permitir que usuários de todos os perfis com acesso ao planejamento excluam
arquivos enviados por upload em planos de aula, provas e relatórios. A
exclusão exige obrigatoriamente um motivo com pelo menos 10 caracteres e o
registro deve permanecer disponível no histórico do planejamento.

## Decisões validadas

- A implementação reutilizará os endpoints e serviços existentes de cada
  módulo.
- Todos os perfis que já possuem acesso ao planejamento poderão excluir o
  arquivo, respeitando unidade, etapa e escopo definidos pela sessão.
- Somente documentos ainda não aprovados poderão ser excluídos. A presença de
  `approvedBy` ou `approvedAt` será suficiente para bloquear a operação.
- O escopo abrange arquivos de upload. Links do YouTube não serão excluídos
  por esse fluxo.
- O motivo será texto livre, obrigatório, com no mínimo 10 caracteres após
  `trim`.
- O motivo ficará salvo no histórico junto do usuário, data e identificação do
  arquivo.
- A operação será permanente para o documento e não terá restauração nesta
  entrega.

## API e regras de negócio

Serão mantidas as rotas atuais:

```text
DELETE /plano-aula/:id/documentos/:docId
DELETE /prova/:id/documentos/:docId
DELETE /relatorio/:id/documento/:docId
```

O corpo da requisição passará a ser:

```json
{
  "motivo": "Arquivo enviado incorretamente para esta quinzena"
}
```

Cada controller deverá aceitar e validar o corpo, enquanto o serviço fará a
validação definitiva. O serviço deverá:

1. localizar o planejamento e validar o acesso do usuário pela sessão;
2. localizar o documento e confirmar que ele pertence ao planejamento;
3. rejeitar links do YouTube e documentos aprovados;
4. guardar os metadados necessários ao histórico;
5. remover o arquivo original e, quando existir, o PDF derivado do storage;
6. registrar a ação no histórico e remover o registro do documento;
7. remover comentários associados ao documento quando aplicável.

A gravação do histórico e a remoção do documento e de seus relacionamentos
deverão ocorrer em uma transação do banco. A limpeza do storage ocorre fora da
transação e seguirá o comportamento tolerante a falhas já adotado pelo
`StorageService`, com registro de aviso nos logs.

O cliente HTTP será ampliado para permitir corpo em requisições `DELETE`, sem
alterar chamadas existentes. Os hooks de plano, prova e relatório passarão a
receber o motivo e enviá-lo à API.

## Histórico e auditoria

A ação `DOCUMENTO_EXCLUIDO` será adicionada aos tipos compartilhados e aos
conjuntos de ações de histórico de plano, prova e relatório.

Os detalhes registrados terão formato comum:

```ts
{
  documentoId: string;
  documentoNome: string;
  documentoTipo: string;
  tamanhoBytes: number | null;
  motivo: string;
}
```

Como os campos `acao` dos históricos são textos tipados no código, não será
necessária uma nova tabela de auditoria. O status anterior e o status novo
serão iguais, pois a exclusão do documento não altera o status do planejamento.

A `HistoricoTimeline` exibirá o rótulo “Documento excluído”, o nome do arquivo
e o motivo. A visualização de histórico usada na tela de relatório também
deverá mostrar esses detalhes.

## Experiência no frontend

Será criado um componente reutilizável de confirmação, como
`ConfirmarExclusaoDocumentoDialog`, usado pelo `DocumentoList` e pela lista
personalizada da análise de relatórios.

O botão de exclusão aparecerá somente para arquivos de upload sem
`approvedBy` e sem `approvedAt`. A API continuará sendo a autoridade final para
impedir uma exclusão em caso de estado desatualizado na tela.

O modal exibirá o nome do arquivo, o aviso de permanência da operação e um
`Textarea` para o motivo. O botão de confirmação ficará desabilitado com menos
de 10 caracteres válidos. Durante a requisição, o modal ficará em estado de
carregamento.

Em caso de sucesso, a tela recarregará o planejamento e o histórico e mostrará
uma confirmação. Em caso de falha, o modal permanecerá aberto com o motivo
preservado para nova tentativa.

## Tratamento de erros e mensagens para usuários

A API manterá códigos técnicos para logs e testes, mas a interface não exibirá
exceções, nomes de endpoints ou mensagens em inglês. O usuário verá uma
explicação curta, direta e compreensível para cada situação:

| Situação | Mensagem exibida |
| --- | --- |
| Motivo inválido | `Informe o motivo da exclusão com pelo menos 10 caracteres.` |
| Documento aprovado | `Este arquivo já foi aprovado e não pode ser excluído.` |
| Link do YouTube | `Links do YouTube não podem ser excluídos por esta opção.` |
| Sem permissão | `Você não tem permissão para excluir este arquivo.` |
| Documento não encontrado | `Este arquivo não foi encontrado. Atualize a página e tente novamente.` |
| Falha inesperada | `Não foi possível excluir o arquivo agora. Tente novamente. Se o problema continuar, procure o suporte.` |

Os códigos `400`, `403`, `404` e `500`, além dos detalhes técnicos, ficarão
restritos à resposta da API e aos logs. O frontend reutilizará
`obterMensagemErro` para converter esses retornos em mensagens amigáveis,
mantendo o modal aberto quando a operação não for concluída.

Os testes deverão verificar não apenas o status HTTP, mas também se cada
cenário apresenta a mensagem correta para uma pessoa sem conhecimento
técnico.

## Testes

### Backend

- validação do motivo após `trim` nos três serviços;
- rejeição de motivo vazio ou menor que 10 caracteres;
- rejeição de documento aprovado;
- rejeição de link do YouTube;
- validação de acesso, unidade e vínculo entre documento e planejamento;
- registro de `DOCUMENTO_EXCLUIDO` com todos os detalhes e ator correto;
- remoção do arquivo original e do PDF derivado;
- remoção dos comentários de documentos de plano;
- comportamento de erro do storage sem apagar o histórico da operação de
  banco;
- controllers aceitando e repassando o motivo.

### Frontend

- modal exige 10 caracteres válidos;
- botão de exclusão não aparece para links ou documentos aprovados;
- sucesso chama a exclusão e atualiza planejamento e histórico;
- falha mantém modal e motivo preenchido;
- hooks enviam o corpo da requisição `DELETE`;
- timeline exibe ação, nome do arquivo e motivo;
- telas de plano, prova e relatório disponibilizam a mesma experiência.

## Fora do escopo

- exclusão do planejamento, prova ou relatório inteiro;
- restauração de arquivo excluído;
- exclusão de links do YouTube;
- criação de uma tabela de auditoria centralizada;
- alteração das regras de aprovação ou do fluxo de submissão.
