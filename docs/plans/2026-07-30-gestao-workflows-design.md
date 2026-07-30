# Fluxos de Gestão do Módulo Workflows

## Objetivo

Completar no frontend os fluxos de gestão já suportados pelo domínio de
workflows, mantendo a página principal focada na operação e tornando modelos,
testes, execuções canceladas, títulos e categorias novamente acessíveis por
navegação normal.

## Decisão de navegação

A página `/workflows` continua sendo a área operacional para todos os usuários:

- biblioteca de modelos publicados;
- execuções em andamento;
- execuções concluídas;
- execuções canceladas.

Usuários de gestão recebem no cabeçalho o acesso `Gerenciar modelos`, apontando
para `/workflows/modelos`. Essa nova página lista modelos de todos os status e
oferece filtros para `Todos`, `Rascunhos`, `Publicados` e `Inativos`.

A gestão de categorias fica em um modal aberto pela página de modelos. Essa
combinação evita sobrecarregar a página operacional e mantém categorias perto
do contexto em que são utilizadas.

## Modelos e execuções de teste

A página `/modelos` consulta `GET /workflows/modelos?status=todos`. Cada card
mostra status, categoria, descrição e acesso à edição.

- `RASCUNHO`: pode iniciar somente execução de teste.
- `PUBLICADO`: continua disponível na biblioteca operacional.
- `INATIVO`: permanece editável e duplicável, mas não inicia execução.

O diálogo de início recebe explicitamente a natureza da execução. Para
rascunhos ele exibe `Iniciar teste` e envia `{ titulo, teste: true }`. Para
publicados mantém `{ titulo }`.

Execuções de teste exibem badge próprio nos cards e no detalhe. A gestão pode
descartá-las em qualquer status, mediante confirmação. Após `DELETE
/workflows/execucoes/:id`, o app retorna para a página principal e a execução
deixa de aparecer.

## Listagem e navegação de execuções

A página principal consulta `GET /workflows/execucoes?status=todos` uma única
vez e deriva as coleções por status. A API já restringe usuários comuns às
próprias execuções reais e permite que a gestão veja todas as execuções da
unidade.

Os cards passam a ser navegáveis para `/execucoes/:id`. Canceladas possuem aba
própria e preservam o motivo de cancelamento no detalhe existente.

## Edição de título

O cabeçalho da execução oferece edição inline para a gestão ou para o usuário
que iniciou a execução. A alteração:

1. valida título normalizado com pelo menos três caracteres;
2. chama `PATCH /workflows/execucoes/:id/titulo`;
3. recarrega o detalhe para refletir resposta e histórico;
4. preserva o título anterior quando a chamada falha.

## Categorias

O modal de categorias lista ativas e inativas e permite:

- criar;
- renomear;
- inativar;
- reativar.

O editor de modelos oferece como novas escolhas somente categorias ativas.
Quando um modelo existente pertence a uma categoria inativa, ela continua
visível como seleção atual para que o formulário não perca o vínculo.

A API deve impedir que uma categoria inativa seja atribuída na criação ou na
troca de categoria de um modelo. Editar outros campos de um modelo já ligado a
uma categoria inativa continua permitido.

## Permissões

As ações de gestão usam `isGestaoWorkflow` no frontend para descoberta e
experiência, mas a autorização continua sendo responsabilidade da API.

Roles de gestão:

- `master`;
- `diretora_geral`;
- `gerente_unidade`;
- `coordenadora_geral`.

## Tratamento de erros

Cada mutação mantém a interface aberta quando falha e apresenta a mensagem
recebida do cliente HTTP. Botões ficam desabilitados durante a chamada para
evitar mutações concorrentes. Descartes e inativações exigem confirmação
explícita quando removem o item do fluxo operacional.

## Testes

O trabalho seguirá TDD com cobertura para:

- visibilidade e navegação da área de gestão;
- listagem de todos os status de modelo;
- início de teste com `teste: true`;
- presença de canceladas na página principal;
- navegação dos cards de execução;
- edição e validação de título;
- descarte exclusivo de execução de teste;
- criação, renomeação, inativação e reativação de categoria;
- bloqueio de categoria inativa na API;
- preservação de categoria inativa já vinculada.

