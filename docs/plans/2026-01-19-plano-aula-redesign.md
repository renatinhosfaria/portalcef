# Redesign do Módulo de Plano de Aula

> **Data:** 19/01/2026
> **Status:** Aprovado para implementação

---

## Contexto

O módulo atual de planejamento foi construído com formulários estruturados (campos de objetivos, metodologia, etc.). O processo real do colégio é diferente:

- Professoras criam documentos no Word/Google Docs
- Entregam via pendrive para análise
- Processo passa por 2 níveis de revisão antes da aprovação

Este redesign alinha o sistema ao processo real.

---

## Fluxo de Aprovação

```
Professora → Analista Pedagógica → Coordenadora Segmento → Aprovado
```

### Hierarquia de Usuários

| Role | Responsabilidade |
|------|------------------|
| Professora | Cria plano de aula (upload de documentos) |
| Analista Pedagógica | Primeira análise de todos os planos da unidade |
| Coordenadora Berçário | Aprovação final - Berçário |
| Coordenadora Infantil | Aprovação final - Infantil |
| Coordenadora Fund. I | Aprovação final - Fundamental I |
| Coordenadora Fund. II | Aprovação final - Fundamental II |
| Coordenadora Geral | Gerencia todos os planos da unidade, define prazos |
| Gerente Unidade | Visualiza todos os planos da unidade |
| Diretora Geral | Visualiza todos os planos de toda a escola |

### Estrutura Turma/Professora

| Etapa | Estrutura |
|-------|-----------|
| Berçário | 1 professora = 1 turma |
| Infantil | 1 professora = 1 turma |
| Fundamental I | 1 professora = 1 turma (todas matérias, exceto inglês) |
| Fundamental II | 1 professora = várias turmas (1 matéria) |

---

## Modelo de Dados

### Tabela: `quinzena_config`

Configuração de prazo por quinzena/unidade.

```sql
CREATE TABLE quinzena_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id),
  quinzena_id VARCHAR(10) NOT NULL,  -- ex: "2026-Q01"
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(unit_id, quinzena_id)
);
```

### Tabela: `plano_aula`

Substitui a tabela `plannings` atual.

```sql
CREATE TABLE plano_aula (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  turma_id UUID NOT NULL REFERENCES turmas(id),
  quinzena_id VARCHAR(10) NOT NULL,

  status VARCHAR(30) NOT NULL DEFAULT 'RASCUNHO',
  -- RASCUNHO, AGUARDANDO_ANALISTA, AGUARDANDO_COORDENADORA,
  -- DEVOLVIDO_ANALISTA, DEVOLVIDO_COORDENADORA, REVISAO_ANALISTA, APROVADO

  submitted_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, turma_id, quinzena_id)
);

CREATE INDEX plano_aula_status_idx ON plano_aula(status);
CREATE INDEX plano_aula_quinzena_idx ON plano_aula(quinzena_id);
```

### Tabela: `plano_documento`

Documentos anexados ao plano.

```sql
CREATE TABLE plano_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID NOT NULL REFERENCES plano_aula(id) ON DELETE CASCADE,

  tipo VARCHAR(20) NOT NULL,  -- 'ARQUIVO' ou 'LINK_YOUTUBE'
  storage_key VARCHAR(500),   -- key no MinIO (para arquivos)
  url VARCHAR(500),           -- URL pública ou link YouTube
  file_name VARCHAR(255),
  file_size INTEGER,
  mime_type VARCHAR(100),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX plano_documento_plano_idx ON plano_documento(plano_id);
```

### Tabela: `documento_comentario`

Comentários por documento (feedback da analista/coordenadora).

```sql
CREATE TABLE documento_comentario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id UUID NOT NULL REFERENCES plano_documento(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES users(id),

  comentario TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX documento_comentario_doc_idx ON documento_comentario(documento_id);
```

---

## Status e Transições

| Status | Descrição | Quem vê como pendente |
|--------|-----------|----------------------|
| `RASCUNHO` | Professora ainda não submeteu | Professora |
| `AGUARDANDO_ANALISTA` | Submetido, aguarda primeira análise | Analista Pedagógica |
| `AGUARDANDO_COORDENADORA` | Analista aprovou, aguarda aprovação final | Coordenadora do Segmento |
| `DEVOLVIDO_ANALISTA` | Analista devolveu para correção | Professora |
| `DEVOLVIDO_COORDENADORA` | Coordenadora devolveu para professora | Professora |
| `REVISAO_ANALISTA` | Coordenadora devolveu para analista re-analisar | Analista Pedagógica |
| `APROVADO` | Aprovação final da coordenadora | Ninguém (concluído) |

### Transições Permitidas

```
RASCUNHO ──────────────────▶ AGUARDANDO_ANALISTA (professora submete)

AGUARDANDO_ANALISTA ───────▶ AGUARDANDO_COORDENADORA (analista aprova)
AGUARDANDO_ANALISTA ───────▶ DEVOLVIDO_ANALISTA (analista devolve)

DEVOLVIDO_ANALISTA ────────▶ AGUARDANDO_ANALISTA (professora re-submete)

AGUARDANDO_COORDENADORA ───▶ APROVADO (coordenadora aprova)
AGUARDANDO_COORDENADORA ───▶ DEVOLVIDO_COORDENADORA (coord. devolve p/ prof.)
AGUARDANDO_COORDENADORA ───▶ REVISAO_ANALISTA (coord. devolve p/ analista)

DEVOLVIDO_COORDENADORA ────▶ AGUARDANDO_ANALISTA (professora re-submete)

REVISAO_ANALISTA ──────────▶ AGUARDANDO_COORDENADORA (analista re-aprova)
REVISAO_ANALISTA ──────────▶ DEVOLVIDO_ANALISTA (analista devolve p/ prof.)
```

**Regra:** Quando a professora re-submete após devolução, sempre volta para a Analista.

---

## Telas por Perfil

### Professora

**Lista de quinzenas:**
- Cards com status do plano de cada quinzena
- Indicadores visuais de status
- Prazo de entrega visível

**Detalhe da quinzena:**
- Info: período, turma, etapa, prazo
- Upload de documentos (drag & drop)
- Lista de documentos enviados
- Comentários de devolução (se houver)
- Botões: "Salvar Rascunho" | "Enviar para Análise"

### Analista Pedagógica

**Dashboard:**
- Abas por segmento: Berçário | Infantil | Fund. I | Fund. II | Todos
- Contador de pendentes por aba
- Filtros: quinzena, turma, status

**Tela de revisão:**
- Preview/download de documentos
- Comentários por documento
- Botões: "Aprovar e Enviar para Coordenação" | "Devolver para Professora"

### Coordenadora de Segmento

**Lista de pendentes:**
- Planos aguardando aprovação final (só do seu segmento)
- Filtros: quinzena, turma, professora

**Tela de revisão:**
- Documentos + comentários da Analista
- Adiciona próprios comentários
- Botões: "Aprovar" | "Devolver para Professora" | "Devolver para Analista"

### Gestão (Coord. Geral, Gerente, Diretora)

**Dashboard:**
- Indicadores: total, % entregues, % aprovados, atrasados
- Gráficos por segmento
- Comparativo entre unidades (Gerente/Diretora)

**Configurações (Coord. Geral):**
- Define prazo de entrega por quinzena

**Lista detalhada:**
- Todos os planos com filtros
- Visualização somente leitura

---

## Endpoints da API

### Professora

```
GET    /planos/minhas-quinzenas          # Lista quinzenas com status
GET    /planos/quinzena/:quinzenaId      # Detalhes + documentos
POST   /planos                            # Cria plano (rascunho)
PATCH  /planos/:id                        # Atualiza plano
POST   /planos/:id/documentos             # Upload de documento
DELETE /planos/:id/documentos/:docId      # Remove documento
POST   /planos/:id/submeter               # Envia para análise
```

### Analista Pedagógica

```
GET    /planos/pendentes-analise          # Lista pendentes
GET    /planos/:id                        # Detalhes do plano
POST   /planos/:id/comentarios            # Adiciona comentário
POST   /planos/:id/aprovar-analista       # Aprova → coordenação
POST   /planos/:id/devolver-analista      # Devolve → professora
```

### Coordenadora de Segmento

```
GET    /planos/pendentes-coordenacao      # Lista pendentes
POST   /planos/:id/aprovar                # Aprovação final
POST   /planos/:id/devolver-professora    # Devolve → professora
POST   /planos/:id/devolver-analista      # Devolve → analista
```

### Gestão

```
GET    /planos/dashboard                  # Indicadores
GET    /planos                            # Lista todos (filtros)
GET    /quinzenas/config                  # Lista prazos
POST   /quinzenas/config                  # Define prazo
```

---

## Plano de Implementação

### Fase 1: Schema e Migração
- Criar novas tabelas
- Migrar dados existentes (se houver)
- Manter tabelas antigas até validação

### Fase 2: API Backend
- Endpoints para fluxo de 2 níveis
- Lógica de permissões por role
- Integração com MinIO

### Fase 3: Telas da Professora
- Upload de documentos
- Visualização de comentários
- Submissão para análise

### Fase 4: Telas da Analista
- Dashboard com pendentes
- Tela de revisão
- Comentários por documento

### Fase 5: Telas das Coordenadoras
- Lista de pendentes
- Aprovação/devolução com escolha de destino

### Fase 6: Telas de Gestão
- Dashboard com indicadores
- Configuração de prazos

---

## Decisões Técnicas

1. **Módulo novo em paralelo:** Criar `plano-aula` separado do `plannings` atual
2. **Migração gradual:** Testar com uma unidade primeiro
3. **Storage:** Reutilizar integração existente com MinIO
4. **Sem versionamento:** Professora substitui documento, não mantém histórico
5. **Notificações:** Apenas no sistema, sem email/WhatsApp
