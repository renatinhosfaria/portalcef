import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { TarefasService } from "../tarefas.service";
import type { UserContext } from "../tarefas.service";

/**
 * TarefaAccessGuard
 *
 * Guard para validar acesso a tarefas específicas baseado em:
 * - Isolamento de tenant (schoolId)
 * - Hierarquia de roles
 * - Relacionamento com a tarefa (criador/responsável)
 *
 * Lógica de autorização:
 * 1. Master: Acesso total a todas as tarefas
 * 2. Diretora geral: Acesso a todas as tarefas da escola
 * 3. Gerentes (unidade/financeiro): Acesso a todas as tarefas da unidade
 * 4. Criador/Responsável: Acesso às tarefas que criou ou é responsável
 * 5. Outros: Sem acesso
 */
@Injectable()
export class TarefaAccessGuard implements CanActivate {
  constructor(private readonly tarefasService: TarefasService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user: UserContext }>();

    const user = request.user;
    const params = request.params as { id?: string };
    const tarefaId = params?.id;

    // Se não há tarefaId no parâmetro, permitir (para endpoints de listagem/criação)
    if (!tarefaId) {
      return true;
    }

    // Buscar tarefa
    const tarefa = await this.tarefasService.findById(tarefaId);

    if (!tarefa) {
      throw new NotFoundException({
        code: "TAREFA_NOT_FOUND",
        message: "Tarefa não encontrada",
      });
    }

    // Validar acesso
    const temAcesso = this.validarAcesso(user, tarefa);

    if (!temAcesso) {
      throw new ForbiddenException({
        code: "UNAUTHORIZED_ACCESS",
        message: "Usuário não tem permissão para acessar esta tarefa",
      });
    }

    return true;
  }

  /**
   * Valida se o usuário tem acesso à tarefa baseado em role e relacionamento
   *
   * @param user Contexto do usuário da sessão
   * @param tarefa Tarefa sendo acessada
   * @returns true se autorizado, false caso contrário
   */
  private validarAcesso(
    user: UserContext,
    tarefa: {
      id: string;
      schoolId: string;
      unitId: string | null;
      criadoPor: string;
      responsavel: string;
    },
  ): boolean {
    // 1. Master: Acesso total
    if (user.role === "master") {
      return true;
    }

    // 2. Validar isolamento de tenant (schoolId)
    if (tarefa.schoolId !== user.schoolId) {
      return false;
    }

    // 3. Diretora geral: Acesso a todas as tarefas da escola
    if (user.role === "diretora_geral") {
      return true;
    }

    // 4. Gerentes (unidade/financeiro): Acesso a todas as tarefas da unidade
    if (user.role === "gerente_unidade" || user.role === "gerente_financeiro") {
      // Validar que gerente tem unitId e que tarefa é da mesma unidade
      if (user.unitId && tarefa.unitId === user.unitId) {
        return true;
      }
    }

    // 5. Criador ou Responsável: Acesso às suas tarefas
    if (
      tarefa.criadoPor === user.userId ||
      tarefa.responsavel === user.userId
    ) {
      return true;
    }

    // 6. Sem acesso
    return false;
  }
}
