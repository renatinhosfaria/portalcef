# API Documentation

Documentacao completa da API REST do Portal Digital Colegio Essencia Feliz.

---

## Informacoes Gerais

### Base URL

| Ambiente        | URL                           |
| --------------- | ----------------------------- |
| Desenvolvimento | `http://localhost:3001`       |
| Producao        | `https://api.essencia.edu.br` |

### Formato de Respostas

Todas as respostas sao em JSON com estrutura padronizada:

**Sucesso:**

```json
{
  "success": true,
  "data": { ... }
}
```

**Erro:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Descricao do erro",
    "details": { ... }
  }
}
```

### Headers Padrao

```http
Content-Type: application/json
Accept: application/json
```

### Codigos de Resposta

| Codigo | Significado       | Quando                |
| ------ | ----------------- | --------------------- |
| 200    | OK                | Operacao bem sucedida |
| 201    | Created           | Recurso criado        |
| 400    | Bad Request       | Validacao falhou      |
| 401    | Unauthorized      | Nao autenticado       |
| 403    | Forbidden         | Sem permissao         |
| 404    | Not Found         | Recurso nao existe    |
| 429    | Too Many Requests | Rate limit excedido   |

---

## Autenticacao

A API utiliza autenticacao baseada em cookies de sessao com Redis.

### Cookie de Sessao

| Atributo | Valor             |
| -------- | ----------------- |
| Nome     | `cef_session`     |
| HttpOnly | `true`            |
| Secure   | `true` (producao) |
| SameSite | `Lax`             |
| Path     | `/`               |
| Max-Age  | 86400 (24 horas)  |

### Dados da Sessao

```typescript
interface SessionData {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
  createdAt: number;
}
```

### Sliding Window

A sessao e renovada automaticamente quando o TTL restante e menor que 25% (6 horas para sessao de 24h).

---

## Endpoints

### Health

#### GET `/health`

Verifica status da API.

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### Auth

#### POST `/auth/login`

Autentica usuario e cria sessao.

**Request:**

```json
{
  "email": "usuario@essencia.edu.br",
  "password": "senha123"
}
```

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "usuario@essencia.edu.br",
      "name": "Nome do Usuario",
      "role": "diretora_geral",
      "schoolId": "uuid",
      "unitId": null,
      "stageId": null
    }
  }
}
```

**Erros:**

- `400`: Dados invalidos
- `401`: Credenciais incorretas

---

#### POST `/auth/logout`

Encerra sessao do usuario.

**Resposta (200):**

```json
{
  "success": true,
  "data": null
}
```

---

#### GET `/auth/me`

Retorna usuario autenticado.

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "usuario@essencia.edu.br",
      "name": "Nome do Usuario",
      "role": "diretora_geral",
      "schoolId": "uuid",
      "unitId": null,
      "stageId": null
    }
  }
}
```

**Erros:**

- `401`: Nao autenticado

---

### Calendar

> Requer autenticacao. Visualizacao: roles de gestao. Edicao: roles de gestao (exceto gerente_financeiro e analista_pedagogico). Exclusao: master, diretora_geral, gerente_unidade, coordenadora_geral.

#### GET `/calendar/events`

Lista eventos do calendario.

**Query Params:**

| Param     | Tipo   | Obrigatorio | Descricao                |
| --------- | ------ | ----------- | ------------------------ |
| unitId    | uuid   | Nao         | Filtrar por unidade      |
| year      | number | Nao         | Filtrar por ano (2020-2100) |
| month     | number | Nao         | Filtrar por mes (1-12)   |
| eventType | string | Nao         | Filtrar por tipo de evento |

**Tipos de Evento:**

- `INICIO_SEMESTRE`, `TERMINO_SEMESTRE`
- `FERIADO`, `RECESSO`, `FERIAS_PROFESSORES`
- `SABADO_LETIVO`, `SEMANA_PROVAS`, `DIA_LETIVO`
- `REUNIAO_PEDAGOGICA`, `EVENTO_ESPECIAL`

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "unitId": "uuid",
      "title": "Feriado de Carnaval",
      "description": "Carnaval 2026",
      "eventType": "FERIADO",
      "startDate": "2026-02-16",
      "endDate": "2026-02-17",
      "isSchoolDay": false,
      "isRecurringAnnually": true,
      "createdBy": "uuid",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### GET `/calendar/events/:id`

Busca evento por ID.

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "unitId": "uuid",
    "title": "Feriado de Carnaval",
    "description": "Carnaval 2026",
    "eventType": "FERIADO",
    "startDate": "2026-02-16",
    "endDate": "2026-02-17",
    "isSchoolDay": false,
    "isRecurringAnnually": true,
    "createdBy": "uuid",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Erros:**

- `404`: Evento nao encontrado

---

#### POST `/calendar/events`

Cria novo evento.

**Request:**

```json
{
  "unitId": "uuid",
  "title": "Feriado de Carnaval",
  "description": "Carnaval 2026",
  "eventType": "FERIADO",
  "startDate": "2026-02-16",
  "endDate": "2026-02-17",
  "isSchoolDay": false,
  "isRecurringAnnually": true
}
```

**Resposta (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "unitId": "uuid",
    "title": "Feriado de Carnaval",
    "eventType": "FERIADO",
    "startDate": "2026-02-16",
    "endDate": "2026-02-17",
    "isSchoolDay": false,
    "isRecurringAnnually": true,
    "createdBy": "uuid",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Erros:**

- `400`: Dados invalidos (VALIDATION_ERROR)
- `403`: Sem permissao para criar eventos

---

#### PUT `/calendar/events/:id`

Atualiza evento existente.

**Request:**

```json
{
  "title": "Carnaval 2026",
  "description": "Feriado de Carnaval",
  "eventType": "FERIADO",
  "startDate": "2026-02-16",
  "endDate": "2026-02-17",
  "isSchoolDay": false,
  "isRecurringAnnually": true
}
```

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Carnaval 2026",
    "eventType": "FERIADO",
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

**Erros:**

- `400`: Dados invalidos
- `403`: Sem permissao para editar eventos
- `404`: Evento nao encontrado

---

#### DELETE `/calendar/events/:id`

Remove evento.

**Resposta (200):**

```json
{
  "success": true,
  "data": null
}
```

**Erros:**

- `403`: Sem permissao para deletar eventos
- `404`: Evento nao encontrado

---

#### GET `/calendar/stats`

Retorna estatisticas do calendario.

**Query Params:**

| Param  | Tipo   | Obrigatorio | Descricao           |
| ------ | ------ | ----------- | ------------------- |
| unitId | uuid   | Nao         | Filtrar por unidade |
| year   | number | Nao         | Ano de referencia   |

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "totalSchoolDays": 200,
    "totalEvents": 45,
    "byMonth": [
      { "month": 1, "schoolDays": 0, "events": 0 },
      { "month": 2, "schoolDays": 17, "events": 3 }
    ]
  }
}
```

---

### Schools

> Requer autenticacao. Leitura (GET /:id): `gerente_financeiro`+. Demais operacoes: `master`

#### GET `/schools`

Lista todas as escolas.

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Colegio Essencia Feliz",
      "code": "essencia-feliz",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### GET `/schools/:id`

Retorna escola especifica.

**Roles permitidas:**

- `master`: Pode acessar qualquer escola
- `diretora_geral`: Pode acessar apenas sua propria escola
- `gerente_financeiro`: Pode acessar apenas sua propria escola

**Parametros:**

- `id`: UUID da escola

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Colegio Essencia Feliz",
    "code": "essencia-feliz",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Erros:**

- `401`: Nao autenticado
- `403`: Usuario nao tem permissao para acessar esta escola
- `404`: Escola nao encontrada

---

#### POST `/schools`

Cria nova escola.

**Request:**

```json
{
  "name": "Colegio Essencia Feliz",
  "code": "essencia-feliz"
}
```

**Resposta (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Colegio Essencia Feliz",
    "code": "essencia-feliz",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

#### PUT `/schools/:id`

Atualiza escola.

**Request:**

```json
{
  "name": "Novo Nome",
  "code": "novo-codigo"
}
```

---

#### DELETE `/schools/:id`

Remove escola.

**Resposta (200):**

```json
{
  "success": true,
  "data": null
}
```

---

### Units

> Requer autenticacao. Leitura: `coordenadora_geral`+. Escrita: `diretora_geral`+

#### GET `/schools/:schoolId/units`

Lista unidades da escola.

**Regras de Acesso:**

- `master`: todas as unidades de qualquer escola
- `diretora_geral`: todas as unidades da escola
- `coordenadora_geral`+: apenas sua unidade

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "schoolId": "uuid",
      "name": "Unidade Santa Monica",
      "code": "santa-monica",
      "address": "Rua das Flores, 123",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### GET `/schools/:schoolId/units/:id`

Retorna unidade especifica.

---

#### POST `/schools/:schoolId/units`

Cria nova unidade.

**Request:**

```json
{
  "name": "Unidade Santa Monica",
  "code": "santa-monica",
  "address": "Rua das Flores, 123"
}
```

---

#### PUT `/schools/:schoolId/units/:id`

Atualiza unidade.

---

#### DELETE `/schools/:schoolId/units/:id`

Remove unidade.

---

### Stages (Etapas de Ensino)

> Gerenciamento de etapas educacionais por unidade.

#### GET `/stages`

Lista todas as etapas globais disponiveis (tabela de referencia).

**Autorizacao:** Todos os usuarios autenticados

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Bercario",
      "code": "bercario",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid",
      "name": "Educacao Infantil",
      "code": "infantil",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### GET `/units/:unitId/stages`

Lista as etapas atribuidas a uma unidade especifica.

**Autorizacao:** Usuarios autenticados com acesso a unidade (TenantGuard)

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Educacao Infantil",
      "code": "infantil",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### POST `/units/:unitId/stages`

Atribui etapas a uma unidade (adiciona as existentes).

**Autorizacao:** Apenas `master`

**Request:**

```json
{
  "stageIds": ["uuid-etapa-1", "uuid-etapa-2"]
}
```

**Resposta (201):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "unitId": "uuid",
      "stageId": "uuid",
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### PUT `/units/:unitId/stages`

Substitui todas as etapas de uma unidade (remove antigas e adiciona novas).

**Autorizacao:** Apenas `master`

**Request:**

```json
{
  "stageIds": ["uuid-etapa-1", "uuid-etapa-3"]
}
```

---

#### DELETE `/units/:unitId/stages/:stageId`

Remove uma etapa de uma unidade (soft delete - marca como inativo).

**Autorizacao:** Apenas `master`

**Resposta (200):**

```json
{
  "success": true,
  "data": null
}
```

---

### Turmas

> Gerenciamento de turmas por unidade e etapa.
> Requer autenticacao. Leitura: `gerente_financeiro`+. Escrita: `gerente_unidade`+

#### GET `/turmas`

Lista todas as turmas com filtros opcionais.

**Autorizacao:** `master`, `diretora_geral`, `gerente_unidade`, `gerente_financeiro`

**Query Parameters:**

- `unitId` (opcional): UUID da unidade
- `stageId` (opcional): UUID da etapa
- `year` (opcional): Ano letivo

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "unitId": "uuid",
      "stageId": "uuid",
      "name": "Infantil 3A",
      "code": "INF-3A",
      "year": 2025,
      "shift": "matutino",
      "capacity": 30,
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### GET `/turmas/:id`

Busca turma especifica por ID.

**Autorizacao:** `master`, `diretora_geral`, `gerente_unidade`, `gerente_financeiro`

**Parametros:**

- `id`: UUID da turma

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "unitId": "uuid",
    "stageId": "uuid",
    "name": "Infantil 3A",
    "code": "INF-3A",
    "year": 2025,
    "shift": "matutino",
    "capacity": 30,
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Erros:**

- `401`: Nao autenticado
- `404`: Turma nao encontrada

---

#### GET `/units/:unitId/turmas`

Lista turmas de uma unidade especifica.

**Autorizacao:** Usuarios autenticados com acesso a unidade (TenantGuard)

**Query Parameters:**

- `year` (opcional): Filtrar por ano letivo

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "unitId": "uuid",
      "stageId": "uuid",
      "name": "Infantil 3A",
      "code": "INF-3A",
      "year": 2025,
      "shift": "matutino",
      "capacity": 30,
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### POST `/turmas`

Cria nova turma.

**Autorizacao:** `master`, `diretora_geral`, `gerente_unidade`
**TenantGuard:** Valida que `unitId` pertence a escola do usuario

**Request:**

```json
{
  "unitId": "uuid",
  "stageId": "uuid",
  "name": "Infantil 3A",
  "code": "INF-3A",
  "year": 2025,
  "shift": "matutino",
  "capacity": 30
}
```

**Validacao:**

- `unitId`: UUID valido (obrigatorio)
- `stageId`: UUID valido (obrigatorio) e deve existir em `unit_stages` para a unidade
- `name`: String de 1-100 caracteres (obrigatorio)
- `code`: String de 1-50 caracteres (obrigatorio)
- `year`: Inteiro entre 2020-2100 (obrigatorio)
- `shift`: Enum `matutino | vespertino | integral` (opcional)
- `capacity`: Inteiro positivo (opcional)

**Constraint Unico:** Nao permite `code` duplicado para mesma `unitId` + `year`

**Resposta (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "unitId": "uuid",
    "stageId": "uuid",
    "name": "Infantil 3A",
    "code": "INF-3A",
    "year": 2025,
    "shift": "matutino",
    "capacity": 30,
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Erros:**

- `400`: Validacao falhou
- `401`: Nao autenticado
- `403`: Sem permissao ou tentando criar turma em outra unidade
- `409`: Codigo de turma ja existe para esta unidade/ano

---

#### PUT `/turmas/:id`

Atualiza turma existente.

**Autorizacao:** `master`, `diretora_geral`, `gerente_unidade`
**TenantGuard:** Valida que turma pertence a escola do usuario

**Request:**

```json
{
  "name": "Infantil 3B",
  "code": "INF-3B",
  "year": 2025,
  "shift": "vespertino",
  "capacity": 25
}
```

**Nota:** Nao permite alterar `unitId` ou `stageId` (omitidos do schema de update)

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "unitId": "uuid",
    "stageId": "uuid",
    "name": "Infantil 3B",
    "code": "INF-3B",
    "year": 2025,
    "shift": "vespertino",
    "capacity": 25,
    "isActive": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T12:00:00.000Z"
  }
}
```

**Erros:**

- `400`: Validacao falhou
- `401`: Nao autenticado
- `403`: Sem permissao
- `404`: Turma nao encontrada

---

#### DELETE `/turmas/:id`

Desativa turma (soft delete).

**Autorizacao:** `master`, `diretora_geral`
**TenantGuard:** Valida que turma pertence a escola do usuario

**Resposta (200):**

```json
{
  "success": true,
  "data": null
}
```

**Erros:**

- `401`: Nao autenticado
- `403`: Sem permissao
- `404`: Turma nao encontrada

---

### Users

> Requer autenticacao com isolamento por tenant

#### GET `/users`

Lista usuarios filtrados por tenant.

**Regras de Acesso:**

- `master`: todos os usuarios
- `diretora_geral`: usuarios da escola
- `gerente_unidade`: usuarios da unidade
- `gerente_financeiro`: usuarios da unidade

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "usuario@essencia.edu.br",
      "name": "Nome do Usuario",
      "role": "professora",
      "schoolId": "uuid",
      "unitId": "uuid",
      "stageId": "uuid",
      "schoolName": "Colegio Essencia Feliz",
      "unitName": "Unidade Santa Monica",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### GET `/users/:id`

Retorna usuario especifico.

**Regras de Acesso:**

- `master`: qualquer usuario
- `diretora_geral`: usuarios da escola
- `gerente_unidade`: usuarios da unidade
- `gerente_financeiro`: usuarios da unidade

---

#### POST `/users`

Cria novo usuario.

**Request:**

```json
{
  "email": "novo@essencia.edu.br",
  "name": "Novo Usuario",
  "password": "senhaForte123!",
  "role": "professora",
  "schoolId": "uuid",
  "unitId": "uuid",
  "stageId": "uuid"
}
```

**Restricoes:**

- `diretora_geral`: pode criar em qualquer unidade da escola
- `gerente_unidade`: pode criar apenas em sua unidade
- `gerente_financeiro`: pode criar apenas em sua unidade
- `stageId` e obrigatorio para roles de etapa (coordenadora_bercario, coordenadora_infantil, coordenadora_fundamental_i, coordenadora_fundamental_ii, coordenadora_medio, professora, auxiliar_sala)

---

#### PUT `/users/:id`

Atualiza usuario.

**Request:**

```json
{
  "name": "Nome Atualizado",
  "role": "coordenadora_geral",
  "stageId": null
}
```

**Regras de Acesso:**

- `diretora_geral`: pode atualizar usuarios da escola
- `gerente_unidade`: pode atualizar usuarios da unidade
- `gerente_financeiro`: pode atualizar usuarios da unidade

**Restricoes:**

- Apenas `diretora_geral` ou `master` pode alterar `unitId`

---

#### DELETE `/users/:id`

Remove usuario.

**Regras de Acesso:**

- `diretora_geral`: pode deletar usuarios da escola
- `gerente_unidade`: pode deletar usuarios da unidade
- `gerente_financeiro`: pode deletar usuarios da unidade

**Restricoes:**

- Nao pode deletar a si mesmo
- Respeita isolamento de tenant

---

### Stages

> Requer autenticacao

#### GET `/stages`

Lista etapas educacionais (education_stages).

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "code": "INFANTIL",
      "name": "Infantil",
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Plannings

> Requer autenticacao

#### POST `/plannings/draft`

Salva rascunho de planejamento (auto-save).

**Request:**

```json
{
  "turma": "INF-3A",
  "quinzena": "2025-Q01",
  "objetivos": "Desenvolver habilidades de leitura...",
  "metodologia": "Rodas de conversa, jogos ludicos...",
  "recursos": "Livros infantis, jogos educativos...",
  "atividades": "Leitura compartilhada..."
}
```

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "turmaId": "INF-3A",
    "quinzena": "2025-Q01",
    "status": "RASCUNHO",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

#### POST `/plannings/submit`

Submete planejamento para coordenacao.

**Request:**

```json
{
  "turma": "INF-3A",
  "quinzena": "2025-Q01",
  "objetivos": "Desenvolver habilidades de leitura...",
  "metodologia": "Rodas de conversa...",
  "recursos": "Livros infantis..."
}
```

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "PENDENTE",
    "submittedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

#### GET `/plannings/dashboard`

Retorna metricas do dashboard.

**Query Parameters:**

- `stage` (opcional): `BERCARIO`, `INFANTIL`, `FUNDAMENTAL_I`, `FUNDAMENTAL_II`, `MEDIO`
- `segment` (opcional, legado): alias de `stage`

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "teachers": [
      {
        "id": "uuid",
        "name": "Maria Silva",
        "turma": "INF-3A",
        "segment": "INFANTIL",
        "planningId": "uuid",
        "planningStatus": "PENDENTE",
        "submittedAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "currentQuinzena": "2025-Q01",
    "deadline": "2025-01-10T23:59:59.000Z"
  }
}
```

---

#### GET `/plannings/segment/:segment`

Lista planejamentos por segmento.

**Parametros:**

- `segment`: `BERCARIO`, `INFANTIL`, `FUNDAMENTAL_I`, `FUNDAMENTAL_II`, `MEDIO` (aceita `FUNDAMENTAL` como alias de `FUNDAMENTAL_I`)

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "professorName": "Maria Silva",
      "turma": "INF-3A",
      "quinzena": "2025-Q01",
      "status": "PENDENTE",
      "submittedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

---

#### GET `/plannings/turmas`

Lista turmas disponiveis para o usuario autenticado.

**Roles permitidas:**

- `professora`
- `auxiliar_sala`

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "unitId": "uuid",
      "stageId": "uuid",
      "professoraId": "uuid",
      "name": "3A",
      "code": "INF-3A",
      "year": 2025,
      "shift": "matutino",
      "capacity": 25,
      "isActive": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z"
    }
  ]
}
```

**Erros:**

- `401`: Nao autenticado
- `403`: Role nao permitida

---

#### GET `/plannings/quinzenas`

Lista quinzenas disponiveis (4 proximas a partir da data atual).

**Roles permitidas:**

- `professora`
- `auxiliar_sala`

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "2025-Q01",
      "label": "Quinzena 1 (01/01 - 15/01)",
      "startDate": "2025-01-01",
      "endDate": "2025-01-15"
    },
    {
      "id": "2025-Q02",
      "label": "Quinzena 2 (16/01 - 31/01)",
      "startDate": "2025-01-16",
      "endDate": "2025-01-31"
    }
  ]
}
```

**Erros:**

- `401`: Nao autenticado
- `403`: Role nao permitida

---

#### GET `/plannings/me/current`

Retorna o planejamento atual da professora logada (quinzena corrente).

**Roles permitidas:**

- `professora`
- `auxiliar_sala`

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "turmaId": "INF-3A",
    "quinzena": "2025-Q01",
    "status": "PENDENTE",
    "content": {
      "objetivos": "...",
      "metodologia": "...",
      "recursos": "...",
      "atividades": "..."
    },
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "submittedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Resposta (200 - sem planejamento):**

```json
{
  "success": true,
  "data": null
}
```

**Erros:**

- `401`: Nao autenticado
- `403`: Role nao permitida

---

#### GET `/plannings/me/feedback`

Retorna feedback pendente da professora (se status EM_AJUSTE).

**Roles permitidas:**

- `professora`
- `auxiliar_sala`

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "planningId": "uuid",
    "reviewerId": "uuid",
    "reviewerName": "Ana Coordenadora",
    "status": "EM_AJUSTE",
    "comentario": "Por favor, detalhe melhor a metodologia.",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

**Resposta (200 - sem feedback):**

```json
{
  "success": true,
  "data": null
}
```

**Erros:**

- `401`: Nao autenticado
- `403`: Role nao permitida

---

#### GET `/plannings/:id`

Retorna detalhes do planejamento.

**Roles permitidas:**

- `master`
- `diretora_geral`
- `coordenadora_geral`
- `coordenadora_*` (todas as coordenadoras de etapa)
- `analista_pedagogico`
- `professora` (apenas seus proprios)

**Validacao de acesso:**

- Professora: so pode acessar planejamentos onde `userId === req.user.userId`
- Coordenacao/Direcao: pode acessar planejamentos da sua unidade/escola

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "turmaId": "INF-3A",
    "quinzena": "2025-Q01",
    "status": "PENDENTE",
    "reviewCycles": 0,
    "firstPassYield": null,
    "content": {
      "objetivos": "...",
      "metodologia": "...",
      "recursos": "...",
      "atividades": "..."
    },
    "reviews": [],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "submittedAt": "2025-01-01T00:00:00.000Z",
    "approvedAt": null
  }
}
```

---

#### GET `/plannings/:id/reviews`

Retorna historico de reviews de um planejamento.

**Roles permitidas:**

- `master`
- `diretora_geral`
- `coordenadora_geral`
- `coordenadora_*` (todas as coordenadoras de etapa)
- `analista_pedagogico`
- `professora` (apenas seus proprios)

**Resposta (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "planningId": "uuid",
      "reviewerId": "uuid",
      "reviewerName": "Ana Coordenadora",
      "status": "EM_AJUSTE",
      "comentario": "Por favor, detalhe melhor a metodologia.",
      "createdAt": "2025-01-01T00:00:00.000Z"
    },
    {
      "id": "uuid",
      "planningId": "uuid",
      "reviewerId": "uuid",
      "reviewerName": "Ana Coordenadora",
      "status": "APROVADO",
      "comentario": "Aprovado! Excelente trabalho.",
      "createdAt": "2025-01-02T00:00:00.000Z"
    }
  ]
}
```

**Erros:**

- `401`: Nao autenticado
- `403`: Usuario nao tem acesso a este planejamento
- `404`: Planejamento nao encontrado

---

#### POST `/plannings/:id/approve`

Aprova planejamento.

**Roles permitidas:**

- `master`
- `diretora_geral`
- `coordenadora_geral`
- `coordenadora_*` (todas as coordenadoras de etapa)

**Request:**

```json
{}
```

**Nota:** O `reviewerId` vem da sessao (`req.user.userId`), nao do body.

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "APROVADO",
    "approvedAt": "2025-01-01T00:00:00.000Z",
    "firstPassYield": true
  }
}
```

---

#### POST `/plannings/:id/request-changes`

Solicita ajustes no planejamento.

**Roles permitidas:**

- `master`
- `diretora_geral`
- `coordenadora_geral`
- `coordenadora_*` (todas as coordenadoras de etapa)

**Request:**

```json
{
  "comment": "Por favor, detalhe melhor a metodologia."
}
```

**Nota:** O `reviewerId` vem da sessao (`req.user.userId`), nao do body.

**Validacao:**

- `comment`: minimo 10 caracteres, maximo 2000 caracteres

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "EM_AJUSTE",
    "reviewId": "uuid-review"
  }
}
```

---

### Stats

> Rate limited: 5 requests / 15 segundos

#### GET `/stats/dashboard`

Retorna estatisticas gerais.

**Resposta (200):**

```json
{
  "success": true,
  "data": {
    "activeSessions": 25,
    "activeUsers": 18,
    "totalUsers": 150,
    "totalSchools": 1,
    "totalUnits": 3
  }
}
```

**Erros:**

- `429`: Too Many Requests

---

## Roles e Permissoes

### Hierarquia

| Role                       | Nivel | Escopo  |
| -------------------------- | ----- | ------- |
| `master`                   | 0     | Global  |
| `diretora_geral`           | 1     | Escola  |
| `gerente_unidade`          | 2     | Unidade |
| `gerente_financeiro`       | 3     | Unidade |
| `coordenadora_geral`       | 4     | Unidade |
| `coordenadora_bercario`    | 5     | Unidade |
| `coordenadora_infantil`    | 6     | Unidade |
| `coordenadora_fundamental_i` | 7   | Unidade |
| `coordenadora_fundamental_ii` | 8  | Unidade |
| `coordenadora_medio`       | 9     | Unidade |
| `analista_pedagogico`      | 10    | Unidade |
| `professora`               | 11    | Unidade |
| `auxiliar_administrativo`  | 12    | Unidade |
| `auxiliar_sala`            | 13    | Unidade |

### Matriz de Permissoes

| Recurso   | master | diretora_geral | gerente\_\*    | coordenadora\_\* | professora     |
| --------- | ------ | -------------- | -------------- | ---------------- | -------------- |
| Schools   | CRUD   | -              | -              | -                | -              |
| Units     | CRUD   | CRUD           | Read           | Read             | -              |
| Users     | CRUD   | CRUD           | CRUD (unidade) | -                | -              |
| Plannings | CRUD   | CRUD           | CRUD           | Approve/Read     | CRUD (proprio) |
| Dashboard | Read   | Read           | Read           | Read (segmento)  | -              |

---

## Multi-Tenant

### Isolamento de Dados

```
master       → Acesso global (todas as escolas)
diretora     → Acesso escola (todas as unidades)
roles de etapa → Acesso unidade + sua etapa
outros roles → Acesso unidade (apenas sua unidade)
```

### Guards

```
Request → AuthGuard → RolesGuard → TenantGuard → Controller
              │            │             │
         Valida sessao  Verifica    Valida escopo
         no Redis       hierarquia   tenant
```

---

## Shop (Loja de Uniformes)

### Endpoints Públicos

#### GET `/shop/locations`

Retorna lista de escolas e unidades disponiveis para a loja.

**Autenticacao:** Nao requerida

**Resposta 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-escola",
      "name": "Colegio Essencia Feliz",
      "code": "essencia-feliz",
      "units": [
        {
          "id": "uuid-unidade",
          "name": "Unidade Santa Monica",
          "code": "santa-monica"
        }
      ]
    }
  ]
}
```

#### GET `/shop/catalog/:schoolId/:unitId`

Retorna catálogo de produtos com estoque disponível.

**Autenticação:** Não requerida

**Parâmetros de Rota:**
- `schoolId` (string, UUID) — ID da escola
- `unitId` (string, UUID) — ID da unidade

**Query Parameters:**
- `category` (opcional) — Filtro por categoria: `UNIFORME_DIARIO`, `UNIFORME_EDUCACAO_FISICA`, `ACESSORIO`
- `size` (opcional) — Filtro por tamanho: `PP`, `P`, `M`, `G`, `GG`, `2`, `4`, `6`, etc.
- `inStock` (opcional, boolean) — Filtrar apenas produtos em estoque

**Resposta 200:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "uuid-produto",
        "name": "Camisa Polo Essência",
        "category": "UNIFORME_DIARIO",
        "description": "Camisa polo manga curta",
        "imageUrl": "https://minio.../camisa-polo.jpg",
        "variants": [
          {
            "id": "uuid-variante",
            "size": "M",
            "price": 8500,
            "availableQuantity": 25
          }
        ]
      }
    ]
  }
}
```

#### POST `/shop/orders`

Cria novo pedido (checkout).

**Autenticação:** Não requerida

**Rate Limiting:** 5 pedidos por hora por IP

**Body:**
```json
{
  "schoolId": "uuid-escola",
  "unitId": "uuid-unidade",
  "customerName": "João Silva",
  "customerPhone": "11987654321",
  "customerEmail": "joao@email.com",
  "items": [
    {
      "variantId": "uuid-variante",
      "studentName": "Maria Silva",
      "quantity": 2
    }
  ],
  "installments": 3
}
```

**Resposta 201:**
```json
{
  "success": true,
  "data": {
    "orderId": "uuid-pedido",
    "orderNumber": "ABC123",
    "total": 17000,
    "paymentIntentClientSecret": "pi_xxx_secret_yyy",
    "expiresAt": "2026-01-09T15:30:00Z"
  }
}
```

**Erros:**
- `400` — Validação falhou (ex: estoque insuficiente)
- `429` — Limite de pedidos excedido

#### GET `/shop/orders/:orderNumber`

Consulta pedido existente por orderNumber.

**Autenticação:** Não requerida (mas requer phone para validação)

**Query Parameters:**
- `phone` (required) — Telefone do cliente (validação)

**Resposta 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "orderNumber": "ABC123",
    "customerName": "João Silva",
    "total": 17000,
    "status": "PAGO",
    "createdAt": "2026-01-09T14:00:00Z",
    "items": [
      {
        "variantSize": "M",
        "productName": "Camisa Polo",
        "studentName": "Maria Silva",
        "quantity": 2,
        "unitPrice": 8500
      }
    ]
  }
}
```

**Erros:**
- `404` — Pedido não encontrado
- `403` — Telefone não corresponde

#### POST `/shop/interest`

Registra interesse em produtos sem estoque.

**Autenticação:** Não requerida

**Body:**
```json
{
  "schoolId": "uuid-escola",
  "unitId": "uuid-unidade",
  "customerName": "João Silva",
  "customerPhone": "11987654321",
  "customerEmail": "joao@email.com",
  "studentName": "Maria Silva",
  "studentClass": "Infantil 3A",
  "notes": "Interesse em tamanho G",
  "items": [
    {
      "variantId": "uuid-variante",
      "quantity": 1
    }
  ]
}
```

**Resposta 201:**
```json
{
  "success": true,
  "data": {
    "requestId": "uuid",
    "message": "Obrigado! Entraremos em contato assim que os produtos estiverem disponíveis."
  }
}
```

---

### Endpoints Administrativos

Todos os endpoints administrativos requerem autenticação e guards:
- **AuthGuard** — Verifica sessão válida
- **RolesGuard** — Valida roles permitidas
- **TenantGuard** — Isola por schoolId/unitId

**Roles com Acesso:**
- `master` — Acesso global
- `diretora_geral` — Todas unidades da escola
- `gerente_unidade` — Apenas sua unidade
- `gerente_financeiro` — Apenas sua unidade
- `auxiliar_administrativo` — Apenas sua unidade

#### GET `/shop/admin/products`

Lista produtos da unidade.

**Query Parameters:**
- `page` (int, default: 1)
- `limit` (int, default: 20)
- `category` (opcional)

**Resposta 200:**
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
```

#### POST `/shop/admin/products`

Cria novo produto.

**Body:**
```json
{
  "name": "Camisa Polo",
  "category": "UNIFORME_DIARIO",
  "description": "Camisa polo manga curta",
  "schoolId": "uuid-escola",
  "unitId": "uuid-unidade",
  "variants": [
    { "size": "M", "price": 8500 },
    { "size": "G", "price": 8500 }
  ]
}
```

**Resposta 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid-produto",
    "name": "Camisa Polo",
    "variants": [...]
  }
}
```

#### PATCH `/shop/admin/products/:id`

Atualiza produto existente.

#### DELETE `/shop/admin/products/:id`

Remove produto (soft delete se houver movimentações).

#### POST `/shop/admin/products/:id/image`

Upload de imagem do produto (MinIO).

**Body:** `multipart/form-data`
- `file` — Arquivo de imagem (max 5MB)

**Resposta 200:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "https://minio.essencia.edu.br/shop/produto-123.jpg"
  }
}
```

#### GET `/shop/admin/inventory`

Lista inventário com estoque atual.

**Query Parameters:**
- `variantId` (opcional) — Filtrar por variante

#### POST `/shop/admin/inventory/entry`

Registra entrada de estoque.

**Body:**
```json
{
  "variantId": "uuid-variante",
  "quantity": 50,
  "reason": "Compra fornecedor X",
  "reference": "NF-12345"
}
```

#### POST `/shop/admin/inventory/adjust`

Ajusta estoque manualmente (inventário físico).

**Body:**
```json
{
  "variantId": "uuid-variante",
  "newQuantity": 45,
  "reason": "Inventário físico - 5 peças danificadas"
}
```

#### GET `/shop/admin/orders`

Lista pedidos da unidade.

**Query Parameters:**
- `page`, `limit` — Paginação
- `status` — Filtro: `AGUARDANDO_PAGAMENTO`, `PAGO`, `RETIRADO`, `CANCELADO`, `EXPIRADO`
- `search` — Busca por orderNumber, customerName, customerPhone

**Resposta 200:**
```json
{
  "success": true,
  "data": [...],
  "meta": { "pagination": {...} }
}
```

#### PATCH `/shop/admin/orders/:id/pickup`

Marca pedido como RETIRADO.

**Resposta 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "RETIRADO",
    "pickedUpAt": "2026-01-09T16:00:00Z",
    "pickedUpBy": "uuid-usuario"
  }
}
```

#### PATCH `/shop/admin/orders/:id/cancel`

Cancela pedido (apenas admin).

**Body:**
```json
{
  "reason": "Pedido duplicado"
}
```

**Resposta 200:**
```json
{
  "success": true,
  "data": { "message": "Pedido cancelado com sucesso" }
}
```

#### POST `/shop/admin/orders/presential`

Registra venda presencial.

**Body:**
```json
{
  "customerName": "João Silva",
  "customerPhone": "11987654321",
  "paymentMethod": "DINHEIRO",
  "items": [
    {
      "variantId": "uuid-variante",
      "studentName": "Maria Silva",
      "quantity": 2
    }
  ]
}
```

**Resposta 201:**
```json
{
  "success": true,
  "data": {
    "orderId": "uuid",
    "orderNumber": "PRE001",
    "total": 17000
  }
}
```

#### GET `/shop/admin/interest`

Lista requisições de interesse.

**Query Parameters:**
- `status` — `PENDENTE`, `CONTATADO`, `TODOS`
- `search` — Busca por nome/telefone
- `page`, `limit` — Paginação

**Resposta 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "customerName": "João Silva",
      "customerPhone": "11987654321",
      "studentName": "Maria Silva",
      "status": "PENDENTE",
      "createdAt": "2026-01-09T10:00:00Z",
      "items": [...]
    }
  ],
  "meta": { "pagination": {...} }
}
```

#### PATCH `/shop/admin/interest/:id/contacted`

Marca interesse como CONTATADO.

**Resposta 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "CONTATADO",
    "contactedAt": "2026-01-09T16:00:00Z",
    "contactedBy": "uuid-usuario"
  }
}
```

#### GET `/shop/admin/interest/summary`

Resumo analítico de interesse.

**Resposta 200:**
```json
{
  "success": true,
  "data": {
    "topVariants": [
      {
        "variantId": "uuid",
        "productName": "Camisa Polo",
        "variantSize": "M",
        "totalQuantity": 25,
        "requestCount": 12
      }
    ],
    "statusCounts": {
      "PENDENTE": 8,
      "CONTATADO": 15
    }
  }
}
```

#### GET `/shop/admin/settings`

Retorna configurações da loja.

**Resposta 200:**
```json
{
  "success": true,
  "data": {
    "maxInstallments": 12,
    "pickupInstructions": "Retirada na secretaria, de segunda a sexta, das 8h às 17h."
  }
}
```

#### PATCH `/shop/admin/settings`

Atualiza configurações.

**Body:**
```json
{
  "maxInstallments": 6,
  "pickupInstructions": "Nova instrução..."
}
```

---

## Exemplos cURL

### Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@essencia.edu.br","password":"senha123"}' \
  -c cookies.txt
```

### Listar Usuarios

```bash
curl -X GET http://localhost:3001/users \
  -H "Accept: application/json" \
  -b cookies.txt
```

### Criar Usuario

```bash
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "email": "professora@essencia.edu.br",
    "password": "senha123",
    "name": "Maria Silva",
    "role": "professora",
    "schoolId": "uuid-escola",
    "unitId": "uuid-unidade"
  }'
```

### Salvar Rascunho

```bash
curl -X POST http://localhost:3001/plannings/draft \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "turma": "INF-3A",
    "quinzena": "2025-Q01",
    "objetivos": "Desenvolver habilidades..."
  }'
```

---

## Suporte

- **Email**: admin@essencia.edu.br
- **Documentacao**: [docs/](../)
