# Design: Sistema de Histórico e Tarefas no Módulo Planejamento

**Data:** 2026-01-21
**Status:** Design Aprovado
**Autor:** Sistema (via Brainstorming)

---

## 📋 Índice

1. [Visão Geral](#-visão-geral)
2. [Requisitos](#-requisitos)
3. [Arquitetura](#-arquitetura)
4. [Schema do Banco de Dados](#-schema-do-banco-de-dados)
5. [API Backend](#-api-backend)
6. [DTOs e Tipos](#-dtos-e-tipos)
7. [Frontend - App Tarefas](#-frontend---app-tarefas)
8. [Widgets e Integração](#-widgets-e-integração)
9. [Histórico no Planejamento](#-histórico-no-planejamento)
10. [Regras de Negócio](#-regras-de-negócio)
11. [Permissões e Segurança](#-permissões-e-segurança)
12. [Considerações Técnicas](#-considerações-técnicas)

---

## 🎯 Visão Geral

### Problema

O módulo de planejamento é colaborativo com múltiplos usuários (professoras, analistas, coordenadoras, gestão) executando ações críticas. Atualmente não há:

1. **Rastreabilidade**: Não sabemos quem fez o quê e quando
2. **Gestão de Tarefas**: Não há controle sobre tarefas pendentes/concluídas
3. **Notificações**: Usuários não são alertados sobre tarefas urgentes

### Solução

Implementar dois sistemas complementares:

1. **Sistema de Histórico** (integrado ao planejamento)
   - Rastreia ações críticas em planos de aula
   - Timeline visual de eventos
   - Auditoria completa do ciclo de vida do plano

2. **Sistema de Tarefas** (módulo independente)
   - Gerenciamento de tarefas com contextos estruturados
   - Tarefas automáticas (workflow) + manuais
   - Painel unificado com notificações in-app

---

## 📝 Requisitos

### Requisitos Funcionais

#### Histórico
- [x] Registrar ações críticas: criação, submissão, aprovações, devoluções
- [x] Armazenar: quem fez, quando fez, status anterior/novo, detalhes
- [x] Visualização em timeline cronológica
- [x] Exibir no detalhe de cada plano

#### Tarefas
- [x] Criar tarefas automáticas baseadas no workflow do planejamento
- [x] Criar tarefas manuais com contextos estruturados
- [x] Campos obrigatórios: título, prioridade, prazo, responsável, contextos
- [x] Estados: Pendente → Concluída
- [x] Visualização: "Criadas por mim" + "Atribuídas a mim"
- [x] Filtros por status, prioridade, módulo, contextos
- [x] Notificações in-app para tarefas atrasadas/urgentes
- [x] Badge visual com contador de tarefas pendentes

### Requisitos Não-Funcionais

- Performance: Resposta < 200ms para listagens
- Escalabilidade: Suportar 1000+ tarefas por usuário
- Segurança: Isolamento de tenant, RBAC por role
- Usabilidade: Interface intuitiva e responsiva

---

## 🏗 Arquitetura

### Visão Geral

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Next.js 15)                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────────┐      ┌─────────────────────────┐   │
│  │ apps/planejamento/ │      │    apps/tarefas/        │   │
│  │                    │      │                         │   │
│  │ - Histórico        │      │ - Dashboard             │   │
│  │   Timeline         │      │ - Criar Tarefa          │   │
│  │                    │      │ - Widgets (Badge)       │   │
│  └────────────────────┘      └─────────────────────────┘   │
│           │                              │                   │
└───────────┼──────────────────────────────┼───────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (NestJS + Fastify)             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────┐      ┌──────────────────────────┐ │
│  │ PlanoAulaModule     │      │    TarefasModule         │ │
│  │                     │      │                          │ │
│  │ - PlanoAulaService  │      │ - TarefasService         │ │
│  │ - HistoricoService  │◄─────┤ - TarefasEventosService  │ │
│  │                     │eventos│                          │ │
│  └─────────────────────┘      └──────────────────────────┘ │
│           │                              │                   │
└───────────┼──────────────────────────────┼───────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────────────────────────────────────────────┐
│                Database (PostgreSQL + Drizzle)              │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  plano_aula_historico          tarefas                       │
│  - id                          - id                          │
│  - plano_id                    - titulo                      │
│  - user_id                     - prioridade                  │
│  - acao                        - prazo                       │
│  - status_anterior             - criado_por                  │
│  - status_novo                 - responsavel                 │
│  - detalhes (jsonb)            - status                      │
│  - created_at                  - tipo_origem                 │
│                                                               │
│                                tarefa_contextos              │
│                                - tarefa_id                   │
│                                - modulo                      │
│                                - quinzena_id                 │
│                                - etapa_id                    │
│                                - turma_id                    │
│                                - professora_id               │
└─────────────────────────────────────────────────────────────┘
```

### Comunicação Entre Sistemas

**Workflow de Eventos**

```
Professora submete plano
    ↓ (evento: plano.submetido)
TarefasEventosService
    ↓ (cria tarefa automática)
Tarefa para Analista
    ↓ (analista aprova)
    ↓ (evento: plano.aprovado_analista)
Tarefa para Coordenadora
    ↓ (coordenadora aprova)
    ↓ (evento: plano.aprovado_final)
Tarefa concluída automaticamente
```

---

## 🗄 Schema do Banco de Dados

### Histórico de Plano de Aula

```typescript
// packages/db/src/schema/plano-aula-historico.ts

export const planoAulaHistorico = pgTable("plano_aula_historico", {
  id: uuid("id").primaryKey().defaultRandom(),
  planoId: uuid("plano_id").notNull().references(() => planoAula.id),

  // Quem fez a ação
  userId: uuid("user_id").notNull().references(() => users.id),
  userName: text("user_name").notNull(), // Desnormalizado
  userRole: text("user_role").notNull(),

  // O que foi feito
  acao: text("acao").notNull(), // CRIADO, SUBMETIDO, APROVADO_ANALISTA, etc.
  statusAnterior: text("status_anterior"),
  statusNovo: text("status_novo").notNull(),

  // Dados adicionais
  detalhes: jsonb("detalhes"), // { comentarios: "...", documentosIds: [...] }

  // Quando
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Índices
CREATE INDEX idx_plano_historico_plano_id ON plano_aula_historico(plano_id);
CREATE INDEX idx_plano_historico_created_at ON plano_aula_historico(created_at DESC);
```

### Sistema de Tarefas

```typescript
// packages/db/src/schema/tarefas.ts

export const tarefas = pgTable("tarefas", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Tenant
  schoolId: uuid("school_id").notNull().references(() => schools.id),
  unitId: uuid("unit_id").references(() => schoolUnits.id),

  // Básico
  titulo: text("titulo").notNull(),
  descricao: text("descricao"),

  // Status e prioridade
  status: text("status").notNull().default("PENDENTE"), // PENDENTE | CONCLUIDA
  prioridade: text("prioridade").notNull(), // ALTA | MEDIA | BAIXA
  prazo: timestamp("prazo").notNull(),

  // Relacionamentos
  criadoPor: uuid("criado_por").notNull().references(() => users.id),
  responsavel: uuid("responsavel").notNull().references(() => users.id),

  // Origem
  tipoOrigem: text("tipo_origem").notNull(), // AUTOMATICA | MANUAL

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  concluidaEm: timestamp("concluida_em"),
});

export const tarefaContextos = pgTable("tarefa_contextos", {
  id: uuid("id").primaryKey().defaultRandom(),
  tarefaId: uuid("tarefa_id").notNull().references(() => tarefas.id, { onDelete: "cascade" }),

  // Contextos estruturados
  modulo: text("modulo").notNull(), // "planejamento", "loja", etc.
  quinzenaId: uuid("quinzena_id").references(() => quinzenas.id),
  etapaId: uuid("etapa_id").references(() => stages.id),
  turmaId: uuid("turma_id").references(() => classes.id),
  professoraId: uuid("professora_id").references(() => users.id),
});

// Índices
CREATE INDEX idx_tarefas_responsavel ON tarefas(responsavel);
CREATE INDEX idx_tarefas_criado_por ON tarefas(criado_por);
CREATE INDEX idx_tarefas_school_id ON tarefas(school_id);
CREATE INDEX idx_tarefas_status ON tarefas(status);
CREATE INDEX idx_tarefas_prazo ON tarefas(prazo);

CREATE INDEX idx_tarefa_contextos_tarefa_id ON tarefa_contextos(tarefa_id);
CREATE INDEX idx_tarefa_contextos_modulo ON tarefa_contextos(modulo);
CREATE INDEX idx_tarefa_contextos_quinzena_id ON tarefa_contextos(quinzena_id);
```

---

## 🔧 API Backend

### Módulo de Histórico (Integrado)

**Service: PlanoAulaHistoricoService**

```typescript
// services/api/src/modules/plano-aula/historico.service.ts

@Injectable()
export class PlanoAulaHistoricoService {

  async registrar(params: {
    planoId: string;
    userId: string;
    userName: string;
    userRole: string;
    acao: AcaoHistorico;
    statusAnterior?: string;
    statusNovo: string;
    detalhes?: any;
  }): Promise<void> {
    await this.db.insert(planoAulaHistorico).values(params);
  }

  async buscarPorPlano(planoId: string): Promise<HistoricoEntry[]> {
    return this.db
      .select()
      .from(planoAulaHistorico)
      .where(eq(planoAulaHistorico.planoId, planoId))
      .orderBy(desc(planoAulaHistorico.createdAt));
  }

  async buscarPorQuinzena(quinzenaId: string): Promise<HistoricoEntry[]> {
    // Busca histórico de todos os planos da quinzena
  }
}
```

**Integração Automática**

```typescript
// Em PlanoAulaService
async submeter(planoId: string, session: UserContext) {
  const plano = await this.findById(planoId);

  // Atualiza status
  await this.update(planoId, { status: 'AGUARDANDO_ANALISTA' });

  // Registra no histórico
  await this.historicoService.registrar({
    planoId,
    userId: session.userId,
    userName: session.userName,
    userRole: session.role,
    acao: 'SUBMETIDO',
    statusAnterior: 'RASCUNHO',
    statusNovo: 'AGUARDANDO_ANALISTA',
  });

  // Emite evento para criação de tarefa
  this.eventEmitter.emit('plano.submetido', { plano, session });
}
```

**Controller: Novo Endpoint**

```typescript
// PlanoAulaController
@Get(':id/historico')
async buscarHistorico(
  @Param('id') planoId: string,
  @CurrentUser() session: UserContext
): Promise<HistoricoEntry[]> {
  await this.service.validateAccess(planoId, session);
  return this.historicoService.buscarPorPlano(planoId);
}
```

### Módulo de Tarefas (Independente)

**Controller: TarefasController**

```typescript
// services/api/src/modules/tarefas/tarefas.controller.ts

@Controller('tarefas')
@UseGuards(AuthGuard, RolesGuard)
export class TarefasController {

  @Get()
  async listar(
    @CurrentUser() session: UserContext,
    @Query() query: ListarTarefasDto
  ): Promise<PaginatedResponse<TarefaEnriquecida>> {
    return this.service.listar(session, query);
  }

  @Post()
  @Roles('professora', 'analista_pedagogico', 'coordenadora_*', 'gerente_*', 'diretora_geral', 'master')
  async criar(
    @CurrentUser() session: UserContext,
    @Body() dto: CriarTarefaDto
  ): Promise<Tarefa> {
    return this.service.criarManual(dto, session);
  }

  @Get(':id')
  @UseGuards(TarefaAccessGuard)
  async buscar(
    @Param('id') id: string
  ): Promise<TarefaEnriquecida> {
    return this.service.buscarComContexto(id);
  }

  @Patch(':id/concluir')
  @UseGuards(TarefaAccessGuard)
  async concluir(
    @Param('id') id: string,
    @CurrentUser() session: UserContext
  ): Promise<void> {
    return this.service.concluir(id, session.userId);
  }

  @Get('stats/resumo')
  async stats(
    @CurrentUser() session: UserContext
  ): Promise<TarefaStats> {
    return this.service.getStats(session.userId);
  }
}
```

**Service: TarefasService**

```typescript
@Injectable()
export class TarefasService {

  async listar(session: UserContext, filtros: FiltrosTarefas): Promise<TarefaEnriquecida[]> {
    // Lista com isolamento de tenant + filtros
  }

  async criarManual(dto: CriarTarefaDto, session: UserContext): Promise<Tarefa> {
    // Valida contextos por role
    // Valida responsável
    // Cria tarefa
  }

  async criarAutomatica(params: CriarTarefaAutomaticaParams): Promise<Tarefa> {
    // Criação via eventos do sistema
  }

  async concluir(tarefaId: string, userId: string): Promise<void> {
    // Marca como concluída + timestamp
    // Invalida cache de stats
  }

  async buscarComContexto(tarefaId: string): Promise<TarefaEnriquecida> {
    // Busca tarefa + join com contextos + dados enriquecidos
  }

  async getStats(userId: string): Promise<TarefaStats> {
    // Cache de 5 minutos
    // Retorna: pendentes, atrasadas, concluídas hoje/semana
  }
}
```

**Service: TarefasEventosService**

```typescript
@Injectable()
export class TarefasEventosService implements OnModuleInit {

  onModuleInit() {
    this.eventEmitter.on('plano.submetido', this.onPlanoSubmetido.bind(this));
    this.eventEmitter.on('plano.aprovado_analista', this.onPlanoAprovadoAnalista.bind(this));
    this.eventEmitter.on('plano.devolvido', this.onPlanoDevolvido.bind(this));
    this.eventEmitter.on('plano.aprovado_final', this.onPlanoAprovadoFinal.bind(this));
  }

  private async onPlanoSubmetido(event: PlanoSubmetidoEvent) {
    const analista = await this.findAnalistaBySegmento(event.turma.stageId);

    await this.tarefasService.criarAutomatica({
      titulo: `Revisar plano - ${event.turma.nome} - Quinzena ${event.quinzena.number}`,
      prioridade: calcularPrioridadeAutomatica(event.quinzena.deadline),
      prazo: event.quinzena.deadline,
      responsavel: analista.id,
      contextos: {
        modulo: 'planejamento',
        quinzenaId: event.quinzena.id,
        etapaId: event.turma.stageId,
        turmaId: event.turma.id,
        professoraId: event.professora.id,
      }
    });
  }

  private async onPlanoAprovadoAnalista(event: PlanoAprovadoEvent) {
    // Cria tarefa para coordenadora
    // Marca tarefa da analista como concluída
  }

  private async onPlanoDevolvido(event: PlanoDevolvido) {
    // Cria tarefa para professora
    // Marca tarefa do revisor como concluída
  }

  private async onPlanoAprovadoFinal(event: PlanoAprovadoFinalEvent) {
    // Marca tarefa da coordenadora como concluída
  }
}
```

---

## 📦 DTOs e Tipos

### DTOs Backend (Zod)

```typescript
// services/api/src/modules/tarefas/dto/tarefas.dto.ts

export const criarTarefaDtoSchema = z.object({
  titulo: z.string().min(3).max(200),
  descricao: z.string().max(1000).optional(),
  prioridade: z.enum(['ALTA', 'MEDIA', 'BAIXA']),
  prazo: z.string().datetime(),
  responsavel: z.string().uuid(),
  contextos: z.object({
    modulo: z.string(),
    quinzenaId: z.string().uuid().optional(),
    etapaId: z.string().uuid().optional(),
    turmaId: z.string().uuid().optional(),
    professoraId: z.string().uuid().optional(),
  }),
});

export const listarTarefasDtoSchema = z.object({
  status: z.enum(['PENDENTE', 'CONCLUIDA']).optional(),
  prioridade: z.enum(['ALTA', 'MEDIA', 'BAIXA']).optional(),
  modulo: z.string().optional(),
  quinzenaId: z.string().uuid().optional(),
  tipo: z.enum(['criadas', 'atribuidas', 'todas']).default('todas'),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(20),
});
```

### Tipos TypeScript Compartilhados

```typescript
// packages/shared/src/types/tarefas.ts

export type TarefaStatus = 'PENDENTE' | 'CONCLUIDA';
export type TarefaPrioridade = 'ALTA' | 'MEDIA' | 'BAIXA';
export type TarefaTipoOrigem = 'AUTOMATICA' | 'MANUAL';

export interface Tarefa {
  id: string;
  titulo: string;
  descricao?: string;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  prazo: string;
  criadoPor: string;
  responsavel: string;
  tipoOrigem: TarefaTipoOrigem;
  createdAt: string;
  concluidaEm?: string;
}

export interface TarefaContexto {
  modulo: string;
  quinzenaId?: string;
  etapaId?: string;
  turmaId?: string;
  professoraId?: string;
}

export interface TarefaEnriquecida extends Tarefa {
  contextos: TarefaContexto;
  criadoPorNome: string;
  responsavelNome: string;
  quinzena?: { number: number; startDate: string; endDate: string };
  etapa?: { nome: string };
  turma?: { nome: string };
  professora?: { nome: string };
  atrasada: boolean;
  diasRestantes: number;
}

export interface TarefaStats {
  pendentes: number;
  atrasadas: number;
  concluidasHoje: number;
  concluidasSemana: number;
}
```

```typescript
// packages/shared/src/types/historico.ts

export type AcaoHistorico =
  | 'CRIADO'
  | 'SUBMETIDO'
  | 'APROVADO_ANALISTA'
  | 'DEVOLVIDO_ANALISTA'
  | 'APROVADO_COORDENADORA'
  | 'DEVOLVIDO_COORDENADORA';

export interface HistoricoEntry {
  id: string;
  planoId: string;
  userId: string;
  userName: string;
  userRole: string;
  acao: AcaoHistorico;
  statusAnterior?: string;
  statusNovo: string;
  detalhes?: any;
  createdAt: string;
}
```

---

## 💻 Frontend - App Tarefas

### Estrutura de Pastas

```
apps/tarefas/
├── app/
│   ├── page.tsx                      # Dashboard principal
│   ├── dashboard-content.tsx         # Client component
│   ├── criar/
│   │   ├── page.tsx
│   │   └── criar-form.tsx
│   ├── [id]/
│   │   ├── page.tsx
│   │   └── tarefa-detail.tsx
│   ├── api/[...path]/route.ts        # Proxy
│   ├── layout.tsx
│   └── globals.css
│
├── features/
│   ├── tarefas-list/
│   │   ├── components/
│   │   │   ├── tarefas-grid.tsx
│   │   │   ├── tarefa-card.tsx
│   │   │   ├── tarefa-filters.tsx
│   │   │   └── empty-state.tsx
│   │   ├── hooks/
│   │   │   └── use-tarefas.ts
│   │   └── types.ts
│   │
│   ├── criar-tarefa/
│   │   ├── components/
│   │   │   ├── contexto-selector.tsx
│   │   │   └── responsavel-selector.tsx
│   │   └── hooks/
│   │       └── use-criar-tarefa.ts
│   │
│   ├── widgets/
│   │   ├── tarefa-badge.tsx
│   │   └── tarefas-pendentes-widget.tsx
│   │
│   └── notificacoes/
│       └── tarefa-notificacao-provider.tsx
│
├── components/
│   ├── prioridade-badge.tsx
│   ├── status-badge.tsx
│   ├── prazo-indicator.tsx
│   └── contexto-chips.tsx
│
└── lib/
    ├── prioridade-utils.ts
    └── prazo-utils.ts
```

### Componentes Principais

**Dashboard Content**

```typescript
export function DashboardContent() {
  const { tarefas, stats, isLoading } = useTarefas();
  const [filtros, setFiltros] = useState<Filtros>({ status: 'PENDENTE', tipo: 'todas' });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Pendentes" value={stats.pendentes} variant="default" />
        <StatCard title="Atrasadas" value={stats.atrasadas} variant="destructive" />
        <StatCard title="Concluídas Hoje" value={stats.concluidasHoje} variant="success" />
        <StatCard title="Concluídas Esta Semana" value={stats.concluidasSemana} variant="success" />
      </div>

      {/* Tabs */}
      <Tabs value={filtros.tipo} onValueChange={(v) => setFiltros({...filtros, tipo: v})}>
        <TabsList>
          <TabsTrigger value="atribuidas">Minhas Tarefas</TabsTrigger>
          <TabsTrigger value="criadas">Criadas por Mim</TabsTrigger>
          <TabsTrigger value="todas">Todas</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filtros */}
      <TarefaFilters filtros={filtros} onChange={setFiltros} />

      {/* Grid */}
      <TarefasGrid tarefas={tarefas} onConcluir={handleConcluir} />
    </div>
  );
}
```

**Tarefa Card**

```typescript
export function TarefaCard({ tarefa, onConcluir }: Props) {
  const { atrasada, diasRestantes } = usePrazoInfo(tarefa.prazo);

  return (
    <Card className={cn(atrasada && "border-destructive")}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-base">{tarefa.titulo}</CardTitle>
            <div className="flex gap-2">
              <PrioridadeBadge prioridade={tarefa.prioridade} />
              <StatusBadge status={tarefa.status} />
            </div>
          </div>
          {tarefa.status === 'PENDENTE' && (
            <Button size="sm" onClick={() => onConcluir(tarefa.id)}>Concluir</Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {tarefa.descricao && <p className="text-sm text-muted-foreground">{tarefa.descricao}</p>}
        <ContextoChips contextos={tarefa.contextos} />
        <PrazoIndicator prazo={tarefa.prazo} atrasada={atrasada} diasRestantes={diasRestantes} />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Por: {tarefa.criadoPorNome}</span>
          <span>Para: {tarefa.responsavelNome}</span>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 🔗 Widgets e Integração

### Badge de Tarefas (Navigation)

```typescript
// apps/tarefas/features/widgets/tarefa-badge.tsx

export function TarefaBadge() {
  const { stats } = useTarefas();
  const router = useRouter();

  if (stats.pendentes === 0) return null;

  return (
    <Button variant="ghost" size="sm" className="relative" onClick={() => router.push('/tarefas')}>
      <CheckSquare className="h-5 w-5" />
      <Badge
        variant={stats.atrasadas > 0 ? "destructive" : "secondary"}
        className="absolute -top-1 -right-1 h-5 w-5 p-0"
      >
        {stats.atrasadas > 0 ? stats.atrasadas : stats.pendentes}
      </Badge>
    </Button>
  );
}
```

### Widget de Tarefas Pendentes

```typescript
// apps/tarefas/features/widgets/tarefas-pendentes-widget.tsx

export function TarefasPendentesWidget({ modulo, contexto }: Props) {
  const { tarefas } = useTarefas({ status: 'PENDENTE', modulo, ...contexto });
  const tarefasUrgentes = tarefas.filter(t => t.atrasada || t.diasRestantes <= 2).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Tarefas Urgentes</span>
          <Badge variant="destructive">{tarefasUrgentes.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tarefasUrgentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma tarefa urgente</p>
        ) : (
          <div className="space-y-2">
            {tarefasUrgentes.map(tarefa => (
              <TarefaCompacta key={tarefa.id} tarefa={tarefa} />
            ))}
          </div>
        )}
        <Button variant="link" className="w-full mt-4" onClick={() => router.push('/tarefas')}>
          Ver todas as tarefas →
        </Button>
      </CardContent>
    </Card>
  );
}
```

### Notificações In-App

```typescript
// apps/tarefas/features/notificacoes/tarefa-notificacao-provider.tsx

export function TarefaNotificacaoProvider({ children }: PropsWithChildren) {
  const { stats, tarefas } = useTarefas({ status: 'PENDENTE' });
  const [mostradas, setMostradas] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Notificação ao entrar
  useEffect(() => {
    if (stats.atrasadas > 0) {
      toast({
        title: `Você tem ${stats.atrasadas} tarefa(s) atrasada(s)`,
        description: "Acesse o painel de tarefas",
        variant: "destructive",
      });
    }
  }, []);

  // Polling de tarefas atrasadas (5min)
  useEffect(() => {
    const interval = setInterval(() => {
      const atrasadas = tarefas.filter(t => t.atrasada && !mostradas.has(t.id));

      atrasadas.forEach(tarefa => {
        toast({
          title: "⚠️ Tarefa Atrasada",
          description: tarefa.titulo,
          variant: "destructive",
        });
        setMostradas(prev => new Set([...prev, tarefa.id]));
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [tarefas]);

  return <>{children}</>;
}
```

---

## 📜 Histórico no Planejamento

### Componente Timeline

```typescript
// apps/planejamento/features/plano-aula/components/historico-timeline.tsx

export function HistoricoTimeline({ planoId }: Props) {
  const { historico, isLoading } = useHistorico(planoId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Ações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

          {historico.map((entry) => (
            <div key={entry.id} className="relative flex gap-4">
              <div className={cn("relative z-10 flex h-8 w-8 items-center justify-center rounded-full", getAcaoColor(entry.acao))}>
                {getAcaoIcon(entry.acao)}
              </div>

              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{getAcaoLabel(entry.acao)}</p>
                <p className="text-sm text-muted-foreground">
                  Por <span className="font-medium">{entry.userName}</span> ({getRoleLabel(entry.userRole)})
                </p>
                <time className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: ptBR })}
                </time>

                {entry.statusAnterior && (
                  <div className="flex items-center gap-2 text-xs">
                    <StatusBadge status={entry.statusAnterior} />
                    <ArrowRight className="h-3 w-3" />
                    <StatusBadge status={entry.statusNovo} />
                  </div>
                )}

                {entry.detalhes?.comentarios && (
                  <Alert className="mt-2">
                    <MessageSquare className="h-4 w-4" />
                    <AlertDescription>{entry.detalhes.comentarios}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

### Integração nas Páginas

**Página de Revisão da Analista**

```typescript
// apps/planejamento/app/analise/[planoId]/revisao-content.tsx

export function RevisaoContent({ planoId }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Documentos e ações */}
      </div>

      <div>
        <HistoricoTimeline planoId={planoId} />
      </div>
    </div>
  );
}
```

**View da Professora**

```typescript
// apps/planejamento/app/plano-aula/[quinzenaId]/plano-content.tsx

export function PlanoContent({ quinzenaId }: Props) {
  return (
    <Tabs defaultValue="documentos">
      <TabsList>
        <TabsTrigger value="documentos">Documentos</TabsTrigger>
        <TabsTrigger value="historico">Histórico</TabsTrigger>
      </TabsList>

      <TabsContent value="documentos">
        {/* Upload e lista */}
      </TabsContent>

      <TabsContent value="historico">
        <HistoricoTimeline planoId={plano.id} />
      </TabsContent>
    </Tabs>
  );
}
```

---

## ⚙️ Regras de Negócio

### Criação Automática de Tarefas

**Prioridade Automática**

```typescript
function calcularPrioridadeAutomatica(deadline: Date): TarefaPrioridade {
  const diasRestantes = differenceInDays(deadline, new Date());

  if (diasRestantes <= 1) return 'ALTA';
  if (diasRestantes <= 3) return 'MEDIA';
  return 'BAIXA';
}
```

**Fluxo Completo**

1. **Professora submete** → Cria tarefa para Analista
2. **Analista aprova** → Cria tarefa para Coordenadora + marca tarefa da analista como concluída
3. **Analista devolve** → Cria tarefa para Professora + marca tarefa da analista como concluída
4. **Coordenadora aprova** → Marca tarefa como concluída (fim do fluxo)
5. **Coordenadora devolve** → Cria tarefa para Professora/Analista + marca tarefa como concluída

### Validações de Criação Manual

**Contextos Obrigatórios por Role**

| Role | Campos Obrigatórios |
|------|---------------------|
| Professora | módulo, quinzenaId |
| Analista | módulo, quinzenaId, etapaId, turmaId, professoraId |
| Coordenadora | módulo, quinzenaId, etapaId, turmaId, professoraId |
| Gerente | módulo, quinzenaId, etapaId, turmaId, professoraId |
| Diretora | módulo, unidadeId, quinzenaId, etapaId, turmaId, professoraId |

**Validações de Responsável**

- Responsável deve existir
- Responsável deve ser da mesma escola
- Professora só pode atribuir para si mesma
- Outros podem atribuir para qualquer usuário do escopo (unidade/escola)

**Validações de Contexto**

- Todas as entidades referenciadas devem existir
- Entidades devem pertencer ao tenant correto
- Prazo não pode estar no passado

---

## 🔐 Permissões e Segurança

### Matriz de Permissões

| Role | Criar | Atribuir | Visualizar | Concluir | Editar/Deletar |
|------|-------|----------|------------|----------|----------------|
| Professora | ✅ | Si mesma | Criadas/Atribuídas | Atribuídas | Criadas |
| Analista | ✅ | Qualquer (unidade) | Criadas/Atribuídas | Atribuídas | Criadas |
| Coordenadora | ✅ | Qualquer (segmento) | Criadas/Atribuídas | Atribuídas | Criadas |
| Gerente | ✅ | Qualquer (unidade) | Todas (unidade) | Atribuídas | Criadas |
| Diretora | ✅ | Qualquer (escola) | Todas (escola) | Atribuídas | Criadas |
| Master | ✅ | Qualquer | Todas | Todas | Todas |

### Guards

**TarefaAccessGuard**

```typescript
@Injectable()
export class TarefaAccessGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const session: UserContext = request.user;
    const tarefa = await this.tarefasService.findById(tarefaId);

    // Master = acesso total
    if (session.role === 'master') return true;

    // Criador ou responsável = acesso
    if (tarefa.criadoPor === session.userId || tarefa.responsavel === session.userId) {
      return true;
    }

    // Validação por role e escopo...

    return false;
  }
}
```

### Isolamento de Tenant

Todas as queries de tarefas incluem filtro de `schoolId`:

```typescript
async listar(session: UserContext, filtros: FiltrosTarefas) {
  return this.db
    .select()
    .from(tarefas)
    .where(
      and(
        eq(tarefas.schoolId, session.schoolId), // ISOLAMENTO
        // ... outros filtros
      )
    );
}
```

---

## 🛠 Considerações Técnicas

### Performance

**Índices do Banco**
- `idx_tarefas_responsavel`, `idx_tarefas_criado_por` - Listagens rápidas
- `idx_tarefas_status`, `idx_tarefas_prazo` - Filtros eficientes
- `idx_plano_historico_plano_id` - Timeline rápida

**Cache de Estatísticas**
- Cache Redis de 5 minutos para stats
- Invalidação ao criar/concluir tarefa

**Paginação**
- Limite de 100 itens por página
- Offset-based pagination (simples)

### Escalabilidade

**Message Queue (Futuro)**

Substituir `EventEmitter` por message queue (RabbitMQ/Redis) para:
- Processamento assíncrono de tarefas automáticas
- Separação de workers
- Retry automático em caso de falha

**Background Workers**

Criação de tarefas automáticas pode ser movida para worker separado.

### Monitoramento

- Logs estruturados em todas as operações críticas
- Métricas: tempo de criação, taxa de erro, tarefas por status

### Testes

**Unitários**
- Services de tarefas e histórico
- Cálculo de prioridade
- Validações de contexto

**Integração**
- Fluxo completo de workflow
- Permissões por role
- Isolamento de tenant

**E2E**
- Workflow end-to-end de um plano
- Verificação de histórico e tarefas em cada etapa

---

## 🎯 Resumo

### O Que Será Implementado

1. **Histórico de Plano de Aula** (integrado)
   - Tabela `plano_aula_historico`
   - Service + endpoint
   - Timeline visual em páginas de revisão

2. **Sistema de Tarefas** (módulo independente)
   - Tabelas `tarefas` + `tarefa_contextos`
   - Módulo completo no backend
   - App frontend dedicado
   - Widgets reutilizáveis
   - Notificações in-app

3. **Integração via Eventos**
   - Tarefas automáticas criadas no workflow
   - Conclusão automática ao aprovar/devolver

### Benefícios

✅ **Rastreabilidade**: Histórico completo de ações
✅ **Organização**: Tarefas pendentes visíveis e priorizadas
✅ **Colaboração**: Atribuição clara de responsabilidades
✅ **Notificações**: Alertas proativos sobre prazos
✅ **Escalabilidade**: Sistema de tarefas reutilizável em outros módulos

---

**Próximo passo:** Criar plano de implementação detalhado
