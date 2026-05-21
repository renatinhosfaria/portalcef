# Observabilidade Tecnica do Planejamento - Design

**Data:** 2026-05-21
**Status:** Design validado em brainstorming
**Escopo:** App `planejamento`, API de planejamento, documentos, provas, gestao, analise e integracoes de arquivo.

## Objetivo

Criar uma trilha tecnica detalhada para diagnosticar reclamacoes de lentidao, erro ao abrir paginas, falha em arquivos, problemas de upload/download, preview e edicao no Word no modulo `planejamento`.

Os usuarios afetados sao leigos e nem sempre conseguem descrever o problema. O sistema deve permitir reconstruir, pelo servidor, o que aconteceu com um usuario em determinado dia e horario.

## Decisoes Validadas

- A consulta inicial sera feita por logs tecnicos no servidor, sem painel interno.
- O rastreamento ficara ativo para todos os usuarios do app `planejamento`.
- A retencao sera de 30 dias.
- O armazenamento sera em arquivo diario `.jsonl`.
- A identificacao do usuario sera intermediaria: `userId`, nome, role, escola e unidade, sem email.
- Eventos do navegador serao enviados ao servidor.
- O log registrara apenas metadados, nunca conteudo digitado, payload sensivel ou conteudo de arquivo.
- O escopo cobre todo o app `planejamento`: plano de aula, gestao, provas, analise, uploads, downloads, preview, impressao e Word.

## Alternativas Consideradas

### Opcao recomendada: logger dedicado na API com eventos do navegador

A API ganha um modulo de observabilidade do planejamento. O app `planejamento` envia eventos tecnicos para esse modulo, e a API complementa esses eventos com os dados reais da sessao. O mesmo logger tambem registra chamadas relevantes da API, SharePoint e storage.

Vantagens:

- Une eventos do navegador e servidor.
- Permite correlacionar pagina, chamada de API, arquivo e erro.
- Mantem os dados no servidor da escola.
- Evita dependencia inicial de servicos externos.

Trade-off:

- Exige instrumentacao em pontos criticos do app e da API.

### Opcao descartada: log apenas no proxy Next.js

Mais simples, mas insuficiente. O proxy mede chamadas HTTP, porem nao enxerga detalhes internos da API, SharePoint, MinIO/storage ou erros especificos de componentes no navegador.

### Opcao descartada no primeiro momento: ferramenta externa

Ferramentas como Sentry ou OpenTelemetry sao mais completas, mas adicionam configuracao, custo, dependencia externa e maior cuidado com dados escolares.

## Arquitetura

### API

Criar um modulo novo, por exemplo `PlanejamentoObservabilidadeModule`, com uma rota autenticada:

```http
POST /api/planejamento-observabilidade/eventos
```

Essa rota recebe eventos tecnicos do navegador, valida o formato, descarta campos proibidos e completa os dados do usuario a partir da sessao autenticada. O navegador nao pode informar quem e o usuario como fonte de verdade.

O modulo tambem deve expor um servico reutilizavel para outros pontos da API registrarem eventos de servidor, como download de documento, preparacao do Word, preview SharePoint, sincronizacao e falhas de storage.

### Escrita de logs

Criar um servico responsavel por:

- Criar o diretorio de logs se ele nao existir.
- Escrever uma linha JSON por evento.
- Usar arquivo diario por data local de Sao Paulo.
- Sanitizar campos sensiveis.
- Truncar mensagens longas.
- Apagar arquivos com mais de 30 dias.
- Falhar em modo `best effort`: erro de log nao pode quebrar o fluxo da usuaria.

Diretorio sugerido em producao:

```text
/var/log/essencia/planejamento
```

Arquivo diario:

```text
planejamento-2026-05-21.jsonl
```

### App Planejamento

Criar uma pequena biblioteca em `apps/planejamento/lib/observabilidade` para:

- Gerar uma `sessaoObservabilidadeId` por aba.
- Registrar abertura e carregamento de pagina.
- Medir duracao de chamadas e acoes criticas.
- Capturar erros JavaScript e rejeicoes nao tratadas.
- Enviar eventos em lote pequeno.
- Descartar eventos se o envio falhar, sem afetar a experiencia da usuaria.

### Proxy Next.js

O proxy `apps/planejamento/app/api/[...path]/route.ts` deve preservar ou gerar um `x-correlation-id` em cada chamada para a API. Esse ID deve voltar para o navegador quando possivel, para conectar:

- evento do navegador;
- chamada feita pelo proxy;
- processamento na API;
- erro ou lentidao no backend.

## Eventos Registrados

### `pagina_aberta`

Registrado quando uma usuaria entra em uma tela do planejamento.

Metadados:

- URL sanitizada.
- Titulo tecnico da tela.
- Tempo ate a tela ficar pronta.
- Navegador e sistema operacional aproximados.
- `sessaoObservabilidadeId`.

### `api_chamada`

Registrado para chamadas relevantes feitas pelo app `planejamento`.

Metadados:

- Metodo HTTP.
- Rota sanitizada.
- Status HTTP.
- Duracao em milissegundos.
- Resultado: sucesso ou falha.
- `correlationId`.

### `api_lenta`

Registrado quando uma chamada ultrapassa o limite configurado. Valor inicial recomendado: 2000 ms.

Metadados adicionais:

- Limite configurado.
- Duracao real.
- Rota sanitizada.

### `arquivo_acao`

Registrado quando a usuaria tenta enviar, abrir, visualizar, baixar, editar no Word, sincronizar ou imprimir um arquivo.

Metadados:

- Tipo de acao.
- `planoId` ou `provaId`, quando houver.
- `documentoId`, quando houver.
- Nome do arquivo, quando ja for metadado visivel no sistema.
- Tipo/extensao.
- Tamanho em bytes, quando disponivel.
- Duracao e resultado.

### `erro_navegador`

Registrado para erro JavaScript, falha de renderizacao, erro de rede, rejeicao nao tratada e erro tecnico capturado pela interface.

Metadados:

- Mensagem sanitizada.
- Nome do erro.
- Stack resumido e truncado.
- URL da pagina.

### `upload_resultado`

Registrado no inicio, sucesso e falha de uploads.

Metadados:

- Nome do arquivo.
- Extensao/MIME informado.
- Tamanho em bytes.
- Duracao.
- Numero da tentativa.
- Status final.

### `sharepoint_word`

Registrado nas operacoes de abrir no Word, gerar link, baixar versao editada, sincronizar arquivo e limpar arquivo temporario.

Metadados:

- Etapa da operacao.
- `documentoId`.
- Duracao.
- Resultado.
- Erro sanitizado, quando houver.

## Estrutura JSONL

Cada linha do arquivo deve ser um JSON independente.

```json
{
  "timestamp": "2026-05-21T14:35:22.180-03:00",
  "ambiente": "production",
  "app": "planejamento",
  "origem": "browser",
  "evento": "arquivo_acao",
  "nivel": "info",
  "correlationId": "uuid",
  "sessaoObservabilidadeId": "uuid",
  "requestId": "uuid",
  "usuario": {
    "id": "uuid",
    "nome": "Maria Silva",
    "role": "professora",
    "schoolId": "uuid",
    "unitId": "uuid"
  },
  "http": {
    "metodo": "GET",
    "rota": "/api/plano-aula/:id/documentos/:docId/download",
    "status": 200,
    "duracaoMs": 1840
  },
  "pagina": {
    "url": "/plano-aula/:quinzenaId",
    "titulo": "Plano de Aula"
  },
  "arquivo": {
    "planoId": "uuid",
    "provaId": null,
    "documentoId": "uuid",
    "nome": "Plano Bercario.docx",
    "tipo": "docx",
    "tamanhoBytes": 180234
  },
  "erro": {
    "codigo": "SHAREPOINT_TIMEOUT",
    "mensagem": "Tempo esgotado ao preparar documento",
    "stackResumo": "PlanoAulaController.editarWord > SharePointService"
  },
  "detalhes": {
    "navegador": "Chrome",
    "sistema": "Windows",
    "duracaoTotalMs": 3020,
    "tentativa": 1,
    "lento": true
  }
}
```

Campos opcionais podem ficar ausentes quando nao se aplicarem. Campos livres devem passar por allowlist.

## Privacidade e Seguranca

O logger deve rejeitar ou remover chaves sensiveis, incluindo:

- `cookie`
- `authorization`
- `token`
- `password`
- `senha`
- `body`
- `payload`
- `conteudo`
- `html`
- `headers`

Regras obrigatorias:

- A rota de eventos exige autenticacao.
- Dados de usuario sempre vem da sessao da API.
- Email nao deve ser registrado.
- Conteudo digitado nunca deve ser registrado.
- Conteudo de arquivo nunca deve ser registrado.
- Mensagens de erro e stack traces devem ser truncados.
- Rotas com UUID devem ser sanitizadas para facilitar buscas agregadas.

## Operacao

No Docker de producao, montar um volume persistente:

```yaml
./logs/planejamento:/var/log/essencia/planejamento
```

Consultas simples no servidor:

```bash
grep '"evento":"api_lenta"' /var/log/essencia/planejamento/planejamento-2026-05-21.jsonl
grep '"documentoId":"<uuid>"' /var/log/essencia/planejamento/planejamento-2026-05-21.jsonl
grep '"id":"<userId>"' /var/log/essencia/planejamento/planejamento-2026-05-21.jsonl
```

A limpeza de arquivos deve rodar:

- ao iniciar a API;
- uma vez por dia por agendamento interno.

## Plano de Testes

### API

- Testar que `POST /api/planejamento-observabilidade/eventos` exige sessao autenticada.
- Testar que a rota ignora qualquer `usuario` enviado pelo navegador e usa a sessao real.
- Testar que campos proibidos sao removidos antes da escrita.
- Testar que mensagens e stack traces sao truncados.
- Testar que o servico escreve uma linha JSON valida no arquivo do dia.
- Testar que erro de escrita nao retorna erro para a usuaria.
- Testar limpeza de arquivos com mais de 30 dias.
- Testar sanitizacao de rotas com UUID.

### App Planejamento

- Testar que a biblioteca cria `sessaoObservabilidadeId`.
- Testar envio em lote para `/api/planejamento-observabilidade/eventos`.
- Testar que falha no envio nao quebra a tela.
- Testar captura de erro de navegador com mensagem sanitizada.
- Testar eventos de abertura de pagina.
- Testar eventos de acoes de arquivo em `DocumentoList`, `DocumentoEditor` e upload.

### Proxy

- Testar que o proxy preserva `x-correlation-id` quando o navegador envia.
- Testar que o proxy gera `x-correlation-id` quando nao existe.
- Testar que o ID e encaminhado para a API.

### Endpoints Criticos

- Testar eventos nos fluxos de download de documento.
- Testar eventos nos fluxos de abrir no Word.
- Testar eventos de falha SharePoint.
- Testar eventos de upload com sucesso e erro.

### Verificacao Operacional

- Em ambiente local ou homologacao, abrir uma pagina do planejamento e confirmar que o arquivo `.jsonl` foi criado.
- Simular uma falha de preview/download e confirmar evento `erro_navegador` ou `arquivo_acao` com `nivel: "error"`.
- Simular uma chamada lenta e confirmar evento `api_lenta`.
- Confirmar que nenhum evento contem `cookie`, `authorization`, `email`, `body`, `payload` ou conteudo de arquivo.

## Criterios de Aceite

- Para qualquer reclamacao com usuario, dia e horario aproximado, deve ser possivel localizar eventos daquele usuario no arquivo diario.
- Eventos de navegador e API devem compartilhar `correlationId` quando fizer sentido.
- A escrita de log nao pode bloquear, atrasar perceptivelmente ou quebrar a experiencia da usuaria.
- Logs devem conter metadados suficientes para rastrear pagina, acao, arquivo, status, duracao e erro.
- Logs com mais de 30 dias devem ser removidos automaticamente.
- O sistema nao deve registrar email, cookies, tokens, payloads sensiveis, texto digitado ou conteudo de arquivo.

## Fora de Escopo Inicial

- Painel interno para consulta.
- Envio para ferramenta externa de observabilidade.
- Gravacao em banco de dados.
- Captura de tela ou gravacao de sessao.
- Registro de conteudo de documentos ou formularios.
