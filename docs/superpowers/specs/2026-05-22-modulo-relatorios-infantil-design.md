# Módulo Relatórios — Educação Infantil

**Data:** 2026-05-22
**Status:** Aprovado para implementação

---

## Contexto

O módulo de Planejamento Pedagógico possui atualmente dois submódulos: Planos de Aula e Provas. Este documento especifica um terceiro submódulo chamado **Relatórios**, exclusivo para turmas das etapas BERCARIO e INFANTIL.

O Relatórios segue o mesmo fluxo do plano de aula: a professora sobe um documento por turma a cada semana, a analista pedagógica revisa e aprova, e a gestão acompanha via painel gerencial.

---

## Escopo

### O que está incluso

- Novo card "Relatórios" na home page do módulo de planejamento
- Fluxo completo de submissão, revisão e aprovação de documentos por turma/semana
- Paridade total de funcionalidades com o módulo de plano de aula
- Restrição de etapa: apenas turmas BERCARIO e INFANTIL

### O que não está incluso

- Relatórios para etapas FUNDAMENTAL_I, FUNDAMENTAL_II ou MEDIO
- Integração com módulo de provas
- Novos tipos de documento além de ARQUIVO e LINK_YOUTUBE

---

## Modelo de Dados

### Tabela `semana_relatorio`

Configura os períodos semanais por unidade e etapa. Gerenciada pela gestão, análoga ao `plano_aula_periodo`.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador |
| `unidadeId` | UUID FK → units | Unidade escolar |
| `etapa` | text (BERCARIO \| INFANTIL) | Etapa educacional |
| `numero` | integer | Número da semana no ano letivo |
| `descricao` | text nullable | Descrição opcional da semana |
| `dataInicio` | date | Início do período |
| `dataFim` | date | Fim do período |
| `dataMaximaEntrega` | date | Prazo máximo de entrega |
| `criadoPor` | UUID FK → users nullable | Quem criou |
| `criadoEm` | timestamp | — |
| `atualizadoEm` | timestamp | — |

Índice único: `(unidadeId, etapa, numero)` — uma semana por número por etapa por unidade.

### Tabela `relatorio`

Registro mestre, um por professora/turma/semana. Análogo ao `plano_aula`.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador |
| `userId` | UUID FK → users | Professora responsável |
| `turmaId` | UUID FK → turmas | Turma |
| `unitId` | UUID FK → units | Unidade |
| `semanaRelatorioId` | UUID FK → semana_relatorio nullable | Período configurado |
| `semanaId` | UUID | Identificador da semana (análogo ao quinzenaId) |
| `status` | enum | Ver fluxo de status abaixo |
| `submittedAt` | timestamp nullable | Momento do envio para análise |
| `approvedAt` | timestamp nullable | Momento da aprovação final |
| `createdAt` | timestamp | — |
| `updatedAt` | timestamp | — |

Índice único: `(userId, turmaId, semanaId)` — uma professora não cria dois relatórios para a mesma turma na mesma semana.

> **Nota — `semanaId` vs `semanaRelatorioId`:** seguindo o padrão do plano de aula, `semanaRelatorioId` é a FK para a tabela de configuração (`semana_relatorio`) e pode ser nula quando a gestão ainda não criou o período. Já `semanaId` é um UUID obrigatório usado como chave de roteamento (aparece na URL), análogo ao `quinzenaId` do plano de aula — identifica a semana de forma estável mesmo antes de existir uma `semana_relatorio` correspondente.

**Restrição de etapa:** validada no service — a turma referenciada deve pertencer a BERCARIO ou INFANTIL.

### Tabela `relatorio_documento`

O arquivo propriamente dito, N:1 com `relatorio`. Análogo ao `plano_documento`.

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | UUID PK | Identificador |
| `relatorioId` | UUID FK → relatorio | Relatório pai |
| `tipo` | enum (ARQUIVO \| LINK_YOUTUBE) | Tipo de documento |
| `storageKey` | varchar(500) nullable | Chave no MinIO (para ARQUIVO) |
| `url` | varchar(1000) nullable | URL completa |
| `fileName` | varchar(255) nullable | Nome original do arquivo |
| `fileSize` | integer nullable | Tamanho em bytes |
| `mimeType` | varchar(100) nullable | Tipo MIME |
| `sharepointItemId` | text nullable | ID do item no SharePoint (edição) |
| `sharepointEditUrl` | text nullable | URL de edição gerada |
| `editandoDesde` | timestamp nullable | Início da sessão de edição |
| `pdfStorageKey` | varchar(500) nullable | PDF derivado no MinIO |
| `pdfUrl` | varchar(1000) nullable | URL pública do PDF |
| `pdfStatus` | enum (NAO_APLICAVEL \| PENDENTE \| GERANDO \| PRONTO \| ERRO) | Estado do PDF |
| `pdfError` | text nullable | Mensagem de erro do PDF |
| `pdfRequestedAt` | timestamp nullable | Quando o PDF foi solicitado |
| `pdfGeneratedAt` | timestamp nullable | Quando o PDF ficou pronto |
| `approvedBy` | UUID FK → users nullable | Analista que aprovou o documento |
| `approvedAt` | timestamp nullable | Momento da aprovação do documento |
| `printedBy` | UUID FK → users nullable | Quem imprimiu |
| `printedAt` | timestamp nullable | Momento da impressão |
| `temComentarios` | boolean | Indicador de comentários (SharePoint) |
| `createdAt` | timestamp | — |
| `updatedAt` | timestamp | — |

### Enum de Status

Idêntico ao `planoAulaStatusEnum`:

```
RASCUNHO → AGUARDANDO_ANALISTA → AGUARDANDO_COORDENADORA → APROVADO
                ↕ DEVOLVIDO_ANALISTA
                              ↕ DEVOLVIDO_COORDENADORA
            REVISAO_ANALISTA (após correção e reenvio)
RECUPERADO (professora cancela envio antes da análise)
```

---

## Backend

### Módulo `relatorio/`

Localização: `services/api/src/modules/relatorio/`

```
relatorio/
├── relatorio.module.ts
├── relatorio.controller.ts
├── relatorio.service.ts
├── relatorio-historico.service.ts
├── relatorio-pdf-queue.service.ts
├── relatorio-pdf-worker.service.ts
├── relatorio.controller.spec.ts
├── relatorio.service.spec.ts
├── relatorio-historico.service.spec.ts
├── relatorio-pdf-queue.service.spec.ts
├── relatorio-pdf-worker.service.spec.ts
└── dto/
    └── relatorio.dto.ts
```

### Endpoints do `relatorio.controller.ts`

Paridade total com `plano-aula.controller.ts`:

| Método | Rota | Descrição | Roles |
|---|---|---|---|
| POST | `/relatorio` | Criar relatório | professora, auxiliar_sala |
| GET | `/relatorio` | Listar meus relatórios | professora, auxiliar_sala |
| GET | `/relatorio/:id` | Buscar por ID | todos com acesso |
| GET | `/relatorio/:id/historico` | Histórico de status | todos com acesso |
| POST | `/relatorio/:id/submeter` | Submeter para análise | professora, auxiliar_sala |
| POST | `/relatorio/:id/recuperar` | Recuperar antes da análise | professora, auxiliar_sala |
| POST | `/relatorio/:id/documento/upload` | Upload de arquivo | professora, auxiliar_sala |
| POST | `/relatorio/:id/documento/youtube` | Adicionar link YouTube | professora, auxiliar_sala |
| PATCH | `/relatorio/:id/documento/:docId` | Atualizar documento | professora, auxiliar_sala |
| DELETE | `/relatorio/:id/documento/:docId` | Remover documento | professora, auxiliar_sala |
| GET | `/relatorio/:id/documento/:docId/download` | Download | todos com acesso |
| POST | `/relatorio/:id/documento/:docId/editar-word` | Iniciar edição SharePoint | professora, auxiliar_sala, analista_pedagogico |
| GET | `/relatorio/:id/documento/:docId/sharepoint` | Visualizar SharePoint | professora, auxiliar_sala, analista_pedagogico |
| POST | `/relatorio/:id/documento/:docId/sincronizar-word` | Sincronizar após edição | professora, auxiliar_sala, analista_pedagogico |
| GET | `/relatorio/analise/pendentes` | Listar pendentes para analista | analista_pedagogico |
| POST | `/relatorio/:id/aprovar-analista` | Aprovar como analista | analista_pedagogico |
| POST | `/relatorio/:id/devolver-analista` | Devolver como analista | analista_pedagogico |
| GET | `/relatorio/coordenadora/pendentes` | Listar pendentes para coordenadora | roles de gestão |
| POST | `/relatorio/:id/aprovar-coordenadora` | Aprovar como coordenadora | roles de gestão |
| POST | `/relatorio/:id/devolver-coordenadora` | Devolver como coordenadora | roles de gestão |
| GET | `/relatorio/gestao/dashboard` | Dashboard gerencial | roles de gestão |
| GET | `/relatorio/gestao/lista` | Listagem gerencial completa | roles de gestão |
| DELETE | `/relatorio/:id` | Deletar relatório | master, diretora_geral |
| POST | `/relatorio/:id/documento/:docId/aprovar` | Aprovar documento individual | analista_pedagogico |
| POST | `/relatorio/:id/documento/:docId/desaprovar` | Desaprovar documento | analista_pedagogico |
| POST | `/relatorio/:id/documento/:docId/regerar-pdf` | Regerar PDF | roles de gestão |
| POST | `/relatorio/:id/documento/:docId/imprimir` | Registrar impressão | roles de gestão |

**Destaque:** Os endpoints de edição SharePoint (`editar-word`, `sharepoint`, `sincronizar-word`) estão disponíveis tanto para a professora quanto para a analista pedagógica.

### Módulo `semana-relatorio/`

Localização: `services/api/src/modules/semana-relatorio/`

Análogo ao `plano-aula-periodo/`. Endpoints:

| Método | Rota | Descrição |
|---|---|---|
| GET | `/semana-relatorio` | Listar semanas por unidade/etapa |
| GET | `/semana-relatorio/turma/:turmaId` | Semanas disponíveis para uma turma |
| GET | `/semana-relatorio/:id` | Buscar por ID |
| POST | `/semana-relatorio` | Criar semana (gestão) |
| PATCH | `/semana-relatorio/:id` | Editar semana (gestão) |
| DELETE | `/semana-relatorio/:id` | Excluir semana (gestão) |

### PDF Assíncrono

`relatorio-pdf-queue.service.ts` + `relatorio-pdf-worker.service.ts` seguem o mesmo padrão do plano de aula: ao aprovar um documento, enfileira geração do PDF; o worker processa e atualiza `pdfStatus` + `pdfUrl`.

---

## Frontend

### Home page (`apps/planejamento/app/page.tsx`)

Adicionar terceiro card "Relatórios" ao grid. Lógica de visibilidade:

- **professora / auxiliar_sala:** card visível somente se a usuária possuir turmas em BERCARIO ou INFANTIL (verificado via endpoint da API ao carregar a página)
- **analista_pedagogico:** sempre visível, direciona para `/relatorios/analise`
- **roles de gestão:** sempre visível, direciona para `/relatorios/gestao`

Função `getRelatorioUrl(dashboardType)` adicionada em `apps/planejamento/app/page.tsx` seguindo o padrão de `getPlanoUrl` e `getProvaUrl`.

### Novas rotas em `apps/planejamento/app/relatorios/`

| Rota | Equivalente no plano de aula | Descrição |
|---|---|---|
| `/relatorios/turmas` | `/planejamentos/turmas` | Professora seleciona turma (filtrado por BERCARIO/INFANTIL) |
| `/relatorios/[semanaId]` | `/planejamentos/[quinzenaId]` | Lista de relatórios da professora na semana |
| `/relatorios/[semanaId]` | `/plano-aula/[quinzenaId]` | Edição do relatório (upload, YouTube, Word) |
| `/relatorios/analise` | `/analise` | Fila de análise pedagógica |
| `/relatorios/analise/[relatorioId]` | `/analise/[planoId]` | Revisão do relatório pela analista (inclui edição Word) |
| `/relatorios/gestao` | `/gestao` | Dashboard gerencial |
| `/relatorios/gestao/semanas` | `/gestao/periodos` | CRUD de semanas pela gestão |
| `/relatorios/gestao/relatorios` | `/gestao/planos` | Listagem gerencial de relatórios |

### Filtro de etapa no frontend

A tela `/relatorios/turmas` exibe apenas turmas cujas etapas são BERCARIO ou INFANTIL. A API reforça essa restrição no backend — o frontend apenas omite do seletor as turmas inelegíveis.

---

## Controle de Acesso

| Role | Acesso |
|---|---|
| `professora`, `auxiliar_sala` | Criar e editar relatórios das próprias turmas (somente BERCARIO/INFANTIL) |
| `analista_pedagogico` | Revisar, editar Word, aprovar/devolver todos os relatórios |
| `coordenadora_bercario`, `coordenadora_infantil` | Aprovação final, gestão de semanas, dashboard |
| `coordenadora_geral`, `gerente_unidade`, `diretora_geral`, `master` | Acesso gerencial completo |
| `coordenadora_fundamental_i`, `coordenadora_fundamental_ii`, `coordenadora_medio` | Acesso gerencial (dashboard, listagem — sem criar semanas de infantil) |

---

## Migrations

Três novas migrations Drizzle (executadas em ordem):

1. `create_semana_relatorio` — tabela de períodos semanais
2. `create_relatorio` — tabela mestre
3. `create_relatorio_documento` — tabela de documentos

---

## Critérios de Aceitação

- [ ] Card "Relatórios" aparece na home apenas para usuários com acesso a turmas BERCARIO/INFANTIL (ou gestão/analista)
- [ ] Professora de turma BERCARIO ou INFANTIL consegue criar, submeter, recuperar e editar relatório semanal
- [ ] Analista pedagógica consegue listar pendentes, editar Word via SharePoint, aprovar e devolver
- [ ] Coordenadora/gestão consegue aprovar como coordenadora e acessar dashboard
- [ ] PDF é gerado assincronamente após aprovação do documento
- [ ] Histórico de status é registrado a cada transição
- [ ] API rejeita criação de relatório para turmas fora de BERCARIO/INFANTIL
- [ ] Todas as rotas novas têm paridade funcional com o plano de aula correspondente
