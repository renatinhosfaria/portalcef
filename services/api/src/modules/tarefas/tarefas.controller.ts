import { Controller, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TarefasService } from "./tarefas.service";

/**
 * TarefasController
 *
 * Controller para gerenciamento de tarefas:
 * - Endpoints para CRUD de tarefas
 * - Filtros avançados com contextos
 * - Controle de acesso via guards
 *
 * NOTA: TenantGuard não é usado pois o isolamento de tenant é feito
 * via schoolId/unitId da sessão. O service valida acesso em cada método.
 */
@Controller("tarefas")
@UseGuards(AuthGuard, RolesGuard)
export class TarefasController {
  constructor(private readonly tarefasService: TarefasService) {}

  // Endpoints serão implementados nas próximas tasks
  // Task 9: Implementar endpoints REST
  // - POST /tarefas - Criar tarefa
  // - GET /tarefas - Listar tarefas (com filtros)
  // - GET /tarefas/:id - Buscar tarefa por ID
  // - PATCH /tarefas/:id - Atualizar tarefa
  // - POST /tarefas/:id/concluir - Marcar como concluída
  // - POST /tarefas/:id/cancelar - Cancelar tarefa
  // - DELETE /tarefas/:id - Deletar tarefa
  // - GET /tarefas/dashboard - Dashboard com estatísticas
}
