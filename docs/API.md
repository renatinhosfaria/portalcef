# API Documentation

Documentacao completa da API REST do Portal Digital Colegio Espaco Feliz.

---

## Informacoes Gerais

### Base URL

| Ambiente            | URL                           |
| ------------------- | ----------------------------- |
| **Desenvolvimento** | `http://localhost:3001`       |
| **Producao**        | `https://api.essencia.edu.br` |

### Formato de Respostas

Todas as respostas sao em **JSON** com a seguinte estrutura:

```json
// Sucesso
{
  "success": true,
  "data": { ... }
}

// Erro
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

---

## Autenticacao

A API utiliza autenticacao baseada em **cookies de sessao**.

### Cookie de Sessao

| Atributo     | Valor             |
| ------------ | ----------------- |
| **Nome**     | `cef_session`     |
| **HttpOnly** | `true`            |
| **Secure**   | `true` (producao) |
| **SameSite** | `Lax`             |
| **Path**     | `/`               |
| **Max-Age**  | 86400 (24 horas)  |

### Dados da Sessao

A sessao armazena o contexto do tenant:

```typescript
interface SessionData {
  userId: string;
  role: string;
  schoolId: string;
  unitId: string;
  createdAt: number;
}
```

---

## Endpoints de Autenticacao

### POST `/auth/login`

Autentica um usuario e cria uma sessao.

**Request:**

```json
{
  "email": "usuario@essencia.edu.br",
  "password": "senha123"
}
```

**Response (200 OK):**

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
      "unitId": null
    }
  }
}
```

### POST `/auth/logout`

Encerra a sessao do usuario.

### GET `/auth/me`

Retorna informacoes do usuario autenticado.

---

## Endpoints de Escolas

> Requer autenticacao e role `master`

### GET `/schools`

Lista escolas (apenas master).

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Colegio Espaco Feliz",
      "code": "colegio-espaco-feliz",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET `/schools/:id`

Retorna uma escola especifica (apenas master).

### POST `/schools`

Cria uma nova escola.

**Request:**

```json
{
  "name": "Colegio Espaco Feliz",
  "code": "colegio-espaco-feliz"
}
```

### PUT `/schools/:id`

Atualiza uma escola.

### DELETE `/schools/:id`

Remove uma escola.

---

## Endpoints de Unidades

> Requer autenticacao. Leitura exige role `coordenadora_geral` ou superior. Escrita exige role `diretora_geral` ou superior.

### GET `/schools/:schoolId/units`

Lista unidades da escola.

- **master**: ve todas as unidades de qualquer escola
- **diretora_geral**: ve todas as unidades da escola
- **gerente_unidade**, **gerente_financeiro**, **coordenadora_geral**: ve apenas sua unidade
- **outros roles**: sem acesso

**Response:**

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
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET `/schools/:schoolId/units/:id`

Retorna uma unidade especifica.

### POST `/schools/:schoolId/units`

Cria uma nova unidade (apenas diretora_geral ou master).

**Request:**

```json
{
  "name": "Unidade Santa Monica",
  "code": "santa-monica",
  "address": "Rua das Flores, 123"
}
```

### PUT `/schools/:schoolId/units/:id`

Atualiza uma unidade (apenas diretora_geral ou master).

### DELETE `/schools/:schoolId/units/:id`

Remove uma unidade (apenas diretora_geral ou master).

---

## Endpoints de Usuarios

> Requer autenticacao com isolamento por tenant

### GET `/users`

Lista usuarios filtrados pelo tenant do usuario autenticado.

- **master**: ve todos usuarios (todas as escolas)
- **diretora_geral**: ve todos usuarios da escola
- **gerente_unidade**, **gerente_financeiro**: ve apenas usuarios da sua unidade
- **outros roles**: sem acesso

**Response:**

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
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### GET `/users/:id`

Retorna um usuario especifico (respeitando isolamento de tenant).

### POST `/users`

Cria um novo usuario (requer role `gerente_financeiro` ou superior).

**Request:**

```json
{
  "email": "novo@essencia.edu.br",
  "name": "Novo Usuario",
  "password": "senhaForte123!",
  "role": "professora",
  "schoolId": "uuid",
  "unitId": "uuid"
}
```

**Restricoes:**

- `diretora_geral`: pode criar usuarios em qualquer unidade da escola
- `gerente_unidade` e `gerente_financeiro`: podem criar usuarios apenas na sua unidade

### PUT `/users/:id`

Atualiza um usuario (requer role `gerente_financeiro` ou superior).

**Request:**

```json
{
  "name": "Nome Atualizado",
  "role": "coordenadora_geral",
  "unitId": "uuid"
}
```

**Restricoes:**

- Apenas `diretora_geral` ou `master` pode transferir usuarios entre unidades (`unitId`)

### DELETE `/users/:id`

Remove um usuario (requer role `gerente_financeiro` ou superior).

**Restricoes:**

- Nao pode deletar a si mesmo
- Respeita isolamento de tenant

---

## Roles e Permissoes

### Hierarquia de Roles

| Role                       | Nivel | Escopo  | Descricao                        |
| -------------------------- | ----- | ------- | -------------------------------- |
| `master`                   | 0     | Global  | Acesso total a todas as escolas  |
| `diretora_geral`           | 1     | Escola  | Acesso total a todas as unidades |
| `gerente_unidade`          | 2     | Unidade | Gestao completa da unidade       |
| `gerente_financeiro`       | 3     | Unidade | Gestao financeira                |
| `coordenadora_geral`       | 4     | Unidade | Coordenacao academica            |
| `coordenadora_infantil`    | 5     | Unidade | Coordenacao infantil             |
| `coordenadora_fundamental` | 6     | Unidade | Coordenacao fundamental          |
| `analista_pedagogico`      | 7     | Unidade | Supervisao pedagogica            |
| `professora`               | 8     | Unidade | Acesso a turmas e alunos         |
| `auxiliar_administrativo`  | 9     | Unidade | Suporte administrativo           |
| `auxiliar_sala`            | 10    | Unidade | Suporte em sala de aula          |

### Matriz de Permissoes

| Recurso        | master | diretora_geral | gerente_unidade | gerente_financeiro | coordenadora_geral | coordenadora_infantil | coordenadora_fundamental | analista_pedagogico | professora | auxiliar_administrativo | auxiliar_sala |
| -------------- | ------ | -------------- | --------------- | ------------------ | ------------------ | --------------------- | ------------------------ | ------------------- | ---------- | ----------------------- | ------------- |
| Schools (CRUD) | Total  | -              | -               | -                  | -                  | -                     | -                        | -                   | -          | -                       | -             |
| Units (CRUD)   | Total  | Total          | -               | -                  | -                  | -                     | -                        | -                   | -          | -                       | -             |
| Units (Read)   | Total  | Total          | Propria         | Propria            | Propria            | -                     | -                        | -                   | -          | -                       | -             |
| Users (CRUD)   | Total  | Total          | Propria         | Propria            | -                  | -                     | -                        | -                   | -          | -                       | -             |
| Users (Read)   | Total  | Total          | Propria         | Propria            | -                  | -                     | -                        | -                   | -          | -                       | -             |

---

## Multi-Tenant

### Fluxo de Autenticacao

```
Request → AuthGuard → RolesGuard → TenantGuard → Controller
                 │
                 ▼
       Valida sessao no Redis
       Extrai: userId, role, schoolId, unitId
                 │
                 ▼
       TenantGuard verifica:
       - se role == master, permite tudo
       - schoolId do recurso == schoolId do usuario
       - unitId do recurso == unitId do usuario (se nao for diretora_geral)
```

### Isolamento de Dados

- Todas as queries sao automaticamente filtradas pelo tenant do usuario
- `master`: ve dados de todas as escolas
- `diretora_geral`: ve dados de toda a escola
- Outros roles: veem apenas dados da sua unidade

---

## Health Check

### GET `/health`

Verifica o status da API.

**Response (200 OK):**

```json
{
  "status": "ok"
}
```

---

## Codigos de Erro

| Codigo | Tipo         | Descricao                      |
| ------ | ------------ | ------------------------------ |
| `400`  | Bad Request  | Dados de entrada invalidos     |
| `401`  | Unauthorized | Autenticacao necessaria        |
| `403`  | Forbidden    | Sem permissao                  |
| `404`  | Not Found    | Recurso nao encontrado         |
| `409`  | Conflict     | Conflito (ex: email duplicado) |

---

## Exemplos com cURL

### Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"diretora_geral@essencia.edu.br","password":"senha123"}' \
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
    "schoolId": "uuid-da-escola",
    "unitId": "uuid-da-unidade"
  }'
```

---

## Suporte

Para duvidas sobre a API, entre em contato:

- **Email**: suporte@essencia.edu.br
- **Documentacao**: [docs/](../)
