# Refatoração: Sistema de Planos de Aula com Períodos Configuráveis

**Data:** 2026-01-26
**Status:** Design Aprovado
**Tipo:** Refatoração Arquitetural - Reset Completo

---

## Resumo Executivo

Reformulação completa do módulo de planejamento, substituindo o modelo de "quinzenas hardcoded" por um sistema flexível de "Planos de Aula" configuráveis por etapa.

### Mudanças Principais

1. **Nomenclatura:** "Quinzena" → "Plano de Aula" (1º, 2º, 3º...)
2. **Configuração:** Períodos criados manualmente pela gestão (não mais hardcoded)
3. **Flexibilidade:** Datas e prazos personalizados por etapa
4. **Permissões:** Coordenadoras por etapa podem criar seus próprios períodos
5. **Reset:** Hard delete de todos os dados existentes

---

## Contexto e Motivação

### Problema Atual

- 21 quinzenas hardcoded em `quinzenas-2026.ts`
- Datas fixas não contemplam particularidades de cada etapa
- Impossível ajustar prazos ou períodos sem alterar código
- Nomenclatura "quinzena" não reflete duração real (pode ter 10, 15, 20 dias)

### Solução Proposta

Sistema configurável onde gestão define períodos de planejamento com:
- Datas início/fim customizadas
- Prazos de entrega flexíveis
- Descrições contextuais
- Numeração automática por etapa

---

## Modelo de Dados

### Nova Tabela: `plano_aula_periodo`

Armazena configurações de períodos criadas pela gestão.

```sql
CREATE TABLE plano_aula_periodo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL,
  numero INTEGER NOT NULL,
  descricao TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  data_maxima_entrega DATE NOT NULL,
  criado_por UUID REFERENCES usuarios(id),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),

  CONSTRAINT idx_periodo_numero_etapa_unidade UNIQUE (unidade_id, etapa, numero)
);

CREATE INDEX idx_plano_aula_periodo_unidade ON plano_aula_periodo(unidade_id);
CREATE INDEX idx_plano_aula_periodo_etapa ON plano_aula_periodo(etapa);
CREATE INDEX idx_plano_aula_periodo_datas ON plano_aula_periodo(data_inicio, data_fim);
```

**Características:**

- `numero`: Calculado automaticamente baseado em ordem cronológica por etapa
- `descricao`: Campo opcional para contexto (ex: "Tema: Meio Ambiente")
- `etapa`: BERCARIO, INFANTIL, FUNDAMENTAL_I, FUNDAMENTAL_II, MEDIO
- Constraint única: não pode ter dois períodos com mesmo número na mesma etapa/unidade

### Atualização Tabela: `plano_aula`

```sql
ALTER TABLE plano_aula DROP COLUMN quinzena_numero;
ALTER TABLE plano_aula ADD COLUMN plano_aula_periodo_id UUID REFERENCES plano_aula_periodo(id) ON DELETE CASCADE;
CREATE INDEX idx_plano_aula_periodo_id ON plano_aula(plano_aula_periodo_id);
```

**Mudança:** Referência de `quinzenaNumero` (hardcoded) para `planoAulaPeriodoId` (configurável).

---

## Lógica de Negócio

### Service: `PlanoAulaPeriodoService`

#### Criação de Período

```typescript
async criarPeriodo(unidadeId: string, etapa: string, dto: CriarPeriodoDto) {
  // 1. Validações básicas obrigatórias
  if (dto.dataInicio >= dto.dataFim) {
    throw new BadRequestException('Data de início deve ser anterior à data de fim');
  }

  if (dto.dataMaximaEntrega < dto.dataInicio) {
    throw new BadRequestException('Data máxima de entrega deve ser posterior à data de início');
  }

  // 2. Validar sobreposição de datas na mesma etapa
  const periodosSobrepostos = await this.verificarSobreposicao(
    unidadeId,
    etapa,
    dto.dataInicio,
    dto.dataFim
  );

  if (periodosSobrepostos.length > 0) {
    throw new BadRequestException('As datas se sobrepõem a um período existente');
  }

  // 3. Calcular número automaticamente
  const numero = await this.calcularProximoNumero(unidadeId, etapa, dto.dataInicio);

  // 4. Criar período
  const periodo = await db.insert(planoAulaPeriodo).values({
    unidadeId,
    etapa,
    numero,
    descricao: dto.descricao,
    dataInicio: dto.dataInicio,
    dataFim: dto.dataFim,
    dataMaximaEntrega: dto.dataMaximaEntrega,
    criadoPor: session.userId,
  }).returning();

  // 5. Renumerar se necessário (inserção no meio)
  await this.renumerarPeriodosSeNecessario(unidadeId, etapa);

  return periodo;
}
```

#### Cálculo Automático de Numeração

Períodos são numerados por ordem cronológica dentro da etapa:

```typescript
async calcularProximoNumero(unidadeId: string, etapa: string, dataInicio: Date): Promise<number> {
  const periodos = await db
    .select()
    .from(planoAulaPeriodo)
    .where(and(
      eq(planoAulaPeriodo.unidadeId, unidadeId),
      eq(planoAulaPeriodo.etapa, etapa)
    ))
    .orderBy(asc(planoAulaPeriodo.dataInicio));

  let posicao = 1;
  for (const periodo of periodos) {
    if (dataInicio < periodo.dataInicio) {
      break;
    }
    posicao++;
  }

  return posicao;
}
```

**Exemplo:**
- Criar período 01/03 → número 1
- Criar período 15/03 → número 2
- Criar período 08/03 → número 2 (sistema renumera o antigo 2 para 3)

#### Edição Controlada

```typescript
async editarPeriodo(periodoId: string, dto: EditarPeriodoDto) {
  const periodo = await this.buscarPorId(periodoId);

  // Verificar se há planos vinculados
  const planosVinculados = await db
    .select({ count: count() })
    .from(planoAula)
    .where(eq(planoAula.planoAulaPeriodoId, periodoId));

  const temPlanosVinculados = planosVinculados[0].count > 0;

  // Validar o que pode ser editado
  const agora = new Date();
  const prazoPassou = periodo.dataMaximaEntrega < agora;

  if (prazoPassou && temPlanosVinculados) {
    // Só permite editar descrição
    if (dto.dataInicio || dto.dataFim || dto.dataMaximaEntrega) {
      throw new BadRequestException(
        'Não é possível alterar datas de um período com prazo expirado e planos vinculados'
      );
    }
  }

  await db.update(planoAulaPeriodo)
    .set({ ...dto, atualizadoEm: new Date() })
    .where(eq(planoAulaPeriodo.id, periodoId));
}
```

**Regras:**
- ✅ Sempre pode editar `descricao`
- ✅ Pode editar datas se prazo não expirou
- ❌ Não pode editar datas se prazo expirou E tem planos vinculados

#### Exclusão Protegida

```typescript
async excluirPeriodo(periodoId: string) {
  const planosVinculados = await db
    .select({ count: count() })
    .from(planoAula)
    .where(eq(planoAula.planoAulaPeriodoId, periodoId));

  if (planosVinculados[0].count > 0) {
    throw new BadRequestException(
      `Não é possível excluir. ${planosVinculados[0].count} professoras já iniciaram este período.`
    );
  }

  await db.delete(planoAulaPeriodo).where(eq(planoAulaPeriodo.id, periodoId));

  // Renumerar períodos restantes
  const periodo = await this.buscarPorId(periodoId);
  await this.renumerarPeriodosSeNecessario(periodo.unidadeId, periodo.etapa);
}
```

---

## Validações

### Validações Básicas Obrigatórias

1. **Datas lógicas:**
   - `dataInicio < dataFim`
   - `dataMaximaEntrega >= dataInicio`

2. **Não-sobreposição:**
   - Não pode criar período com datas que conflitam com outro período da mesma etapa

3. **Integridade:**
   - Não pode excluir período com planos vinculados
   - Edição de datas restrita quando prazo expirou + planos vinculados

---

## Interface de Gestão

### Página: `/planejamento/gestao`

Acessível por:
- Diretora Geral
- Gerente Unidade
- Coordenadora Geral
- Coordenadora Infantil
- Coordenadora Fundamental I/II
- Coordenadora Berçário
- Coordenadora Médio

### Estrutura

```tsx
<PeriodosGestaoPage>
  <Header>
    <h1>Gestão de Planos de Aula</h1>
    <Button>Adicionar Plano de Aula</Button>
  </Header>

  <Filtros>
    <Select etapa />
    <Select ano />
  </Filtros>

  <EtapasPeriodosList>
    {etapas.map(etapa => (
      <Card etapa>
        <Table>
          <Row>
            <Col>Nº Plano</Col>
            <Col>Descrição</Col>
            <Col>Data Início</Col>
            <Col>Data Fim</Col>
            <Col>Prazo Entrega</Col>
            <Col>Turmas Afetadas</Col>
            <Col>Ações (Editar/Excluir)</Col>
          </Row>
        </Table>
      </Card>
    ))}
  </EtapasPeriodosList>

  <PeriodoModal />
</PeriodosGestaoPage>
```

### Permissões por Perfil

| Perfil | Visualização | Criação/Edição |
|--------|--------------|----------------|
| Diretora Geral | Todas etapas | Todas etapas |
| Gerente Unidade | Todas etapas | Todas etapas |
| Coordenadora Geral | Todas etapas | Todas etapas |
| Coordenadora Infantil | Todas etapas | Apenas Infantil |
| Coordenadora Fundamental I | Todas etapas | Apenas Fundamental I |
| Coordenadora Berçário | Todas etapas | Apenas Berçário |

**Lógica:** Todas coordenadoras veem todos os períodos (transparência), mas só podem criar/editar da sua etapa (responsabilidade compartimentada).

### Modal de Criação

Campos:
- **Etapa:** Select (filtrado por permissões do usuário)
- **Descrição:** Textarea opcional
- **Data Início:** DatePicker
- **Data Fim:** DatePicker
- **Data Máxima Entrega:** DatePicker

Validações client-side:
- Datas lógicas
- Feedback visual se houver conflito

---

## Experiência da Professora

### Cenário 1: Sem Períodos Configurados

```tsx
<EmptyState>
  <Icon>CalendarX</Icon>
  <Title>Nenhum Plano de Aula disponível ainda</Title>
  <Description>
    A coordenação ainda não configurou os períodos de planejamento
    para sua turma (Infantil).
  </Description>
  <Hint>
    Aguarde a coordenação criar os Planos de Aula.
    Você será notificada quando estiverem disponíveis.
  </Hint>
</EmptyState>
```

**Comportamento:**
- Sem erro, sem bloqueio
- Mensagem informativa e clara
- Professora entende que precisa aguardar

### Cenário 2: Com Períodos Configurados

```tsx
<ListaPlanosProfessora>
  <Header>
    <h1>Meus Planos de Aula</h1>
    <p>Turma: {turmaNome} • {etapa}</p>
  </Header>

  {periodos.map(periodo => (
    <PeriodoCard>
      <Title>
        {periodo.numero}º Plano de Aula
        <Badge status />
      </Title>

      <Description>{periodo.descricao}</Description>

      <Grid>
        <Field>
          Período: {dataInicio} até {dataFim}
        </Field>
        <Field>
          Prazo de Entrega: {dataMaximaEntrega}
          {prazoProximo && <Badge warning />}
          {prazoExpirado && <Badge danger />}
        </Field>
        <Field>
          Status: {planoExistente?.status || 'Não iniciado'}
        </Field>
      </Grid>

      <Button>
        {planoExistente ? 'Continuar Plano' : 'Iniciar Plano de Aula'}
      </Button>
    </PeriodoCard>
  ))}
</ListaPlanosProfessora>
```

### Mudança de Rota

**Antes:** `/planejamento/plano-aula/1` (número hardcoded)
**Agora:** `/planejamento/plano-aula/[periodoId]` (UUID)

---

## Migração e Deploy

### Estratégia: Hard Delete (Reset Completo)

**Motivo:** Sistema começa limpo com novo modelo, sem dados legados.

### Pipeline de Deploy

#### 1. Backup Completo

```bash
./scripts/backup-pre-migracao-periodos.sh
```

Cria:
- Backup completo do banco
- Backup específico das tabelas afetadas
- Timestamp para recuperação

#### 2. Janela de Manutenção

**Duração estimada:** 1h30
**Horário recomendado:** 22h00 às 23h30 (horário de Brasília)

**Comunicação prévia:**
- E-mail 7 dias antes
- Lembrete 1 dia antes
- Aviso no sistema 2 horas antes

#### 3. Migration SQL

```sql
BEGIN;

-- 1. Remover dados antigos (hard delete)
DELETE FROM plano_aula_historico WHERE plano_aula_id IN (SELECT id FROM plano_aula);
DELETE FROM plano_aula_comentarios WHERE plano_aula_id IN (SELECT id FROM plano_aula);
DELETE FROM quinzena_documents;
DELETE FROM plano_aula;

-- 2. Criar nova tabela plano_aula_periodo
CREATE TABLE plano_aula_periodo (...);

-- 3. Alterar tabela plano_aula
ALTER TABLE plano_aula DROP COLUMN quinzena_numero;
ALTER TABLE plano_aula ADD COLUMN plano_aula_periodo_id UUID REFERENCES plano_aula_periodo(id);

-- 4. Remover tabelas obsoletas
DROP TABLE IF EXISTS quinzena_config CASCADE;

COMMIT;
```

#### 4. Deploy da Aplicação

```bash
./scripts/deploy-migracao-periodos.sh
```

Passos:
1. Parar containers (API + Planejamento)
2. Aplicar migration SQL
3. Rebuild com novo código
4. Restart containers
5. Health check

#### 5. Validação Pós-Deploy

```bash
./scripts/validacao-pos-deploy-periodos.sh
```

Verifica:
- Tabela `plano_aula_periodo` criada
- Coluna `plano_aula_periodo_id` existe
- Dados antigos foram removidos (`COUNT(*) = 0`)
- API respondendo corretamente

### Rollback

Se houver problemas:

```bash
./scripts/rollback-migracao-periodos.sh <caminho-backup.sql>
```

Passos:
1. Parar aplicação
2. Restaurar backup do banco
3. Checkout versão anterior do código (git)
4. Rebuild e restart

---

## Arquivos a Remover

Após migração bem-sucedida:

```
packages/shared/src/config/quinzenas-2026.ts
packages/shared/src/config/quinzenas-*.ts
```

Imports que referenciam esses arquivos causarão erros TypeScript, facilitando identificação.

---

## Endpoints da API

### Novos Endpoints

```
POST   /api/plano-aula-periodo                    # Criar período
GET    /api/plano-aula-periodo                    # Listar todos
GET    /api/plano-aula-periodo/:id                # Buscar por ID
GET    /api/plano-aula-periodo/turma/:turmaId     # Buscar períodos da turma
PUT    /api/plano-aula-periodo/:id                # Editar período
DELETE /api/plano-aula-periodo/:id                # Excluir período
```

### Guards

```typescript
@Post()
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
@Roles('diretora_geral', 'gerente_unidade', 'coordenadora_geral',
       'coordenadora_infantil', 'coordenadora_fundamental_i', /* ... */)
async criarPeriodo(@Body() dto: CriarPeriodoDto, @CurrentUser() session) {
  // Validar se coordenadora específica pode criar para esta etapa
  if (!this.podeEditarEtapa(session.role, dto.etapa)) {
    throw new ForbiddenException('Sem permissão para criar períodos desta etapa');
  }

  return this.service.criarPeriodo(session.unidadeId, dto.etapa, dto);
}
```

---

## Cronograma Sugerido

| Fase | Duração | Descrição |
|------|---------|-----------|
| **Planejamento** | 1 dia | Revisão final do design, aprovação stakeholders |
| **Implementação Backend** | 3 dias | Schema, migrations, services, controllers, testes |
| **Implementação Frontend** | 3 dias | Interface gestão, experiência professora, testes |
| **Testes Integração** | 2 dias | Teste E2E, validação fluxos completos |
| **Comunicação Usuários** | 7 dias | E-mails, avisos no sistema |
| **Deploy Produção** | 1 dia | Janela manutenção, migração, validação |
| **Suporte Pós-Deploy** | 3 dias | Monitoria, ajustes, suporte coordenadoras |

**Total:** ~20 dias (3 semanas)

---

## Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Perda de dados por erro na migration | Baixa | Alto | Backup completo, validação em staging, rollback testado |
| Usuários não entendem novo fluxo | Média | Médio | Comunicação clara, tutoriais, suporte ativo |
| Coordenadoras não criam períodos | Média | Alto | Comunicação prévia, treinamento, template de exemplo |
| Performance na listagem de períodos | Baixa | Baixo | Índices adequados, paginação se necessário |
| Bugs em validação de datas | Média | Médio | Testes automatizados extensivos, validação client + server |

---

## Métricas de Sucesso

**Técnicas:**
- ✅ Zero downtime não planejado
- ✅ Tempo de resposta API < 200ms
- ✅ 100% dos testes passando

**Negócio:**
- ✅ 100% coordenadoras criaram períodos na primeira semana
- ✅ < 5 tickets de suporte sobre novo sistema
- ✅ Professoras conseguem acessar planos sem bloqueios

**Usuário:**
- ✅ Satisfação coordenadoras com flexibilidade de datas
- ✅ Professoras entendem nomenclatura "Plano de Aula"
- ✅ Zero reclamações sobre perda de trabalho (pois reset foi comunicado)

---

## Próximos Passos

1. ✅ **Design aprovado** → Este documento
2. ⏳ **Criar plano de implementação** detalhado (usar skill `writing-plans`)
3. ⏳ **Configurar worktree** isolado (usar skill `using-git-worktrees`)
4. ⏳ **Implementação TDD** (usar skill `test-driven-development`)
5. ⏳ **Code review** antes de merge (usar skill `requesting-code-review`)
6. ⏳ **Deploy produção** seguindo este plano

---

## Apêndices

### Glossário

| Termo | Definição |
|-------|-----------|
| **Plano de Aula** | Documento pedagógico criado pela professora para um período específico |
| **Período** | Configuração de datas (início, fim, prazo) criada pela gestão |
| **Etapa** | Nível educacional (Berçário, Infantil, Fundamental I/II, Médio) |
| **Quinzena** (deprecated) | Termo antigo, substituído por "Plano de Aula" |

### Referências

- [CLAUDE.md](../CLAUDE.md) - Regras do projeto
- [API.md](../API.md) - Documentação de endpoints
- [DATABASE.md](../DATABASE.md) - Schema do banco
- [Superpowers Skills](.agent/README.md) - Workflows de desenvolvimento

---

**Documento validado e aprovado em:** 2026-01-26
**Autores:** Equipe de Desenvolvimento + Stakeholders
**Próxima revisão:** Após implementação (retrospectiva)
