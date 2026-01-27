import { BadRequestException } from "@nestjs/common";
import type { TarefaPrioridade } from "@essencia/shared/types";

/**
 * Valida contextos obrigatórios baseados na role do usuário
 *
 * @param role Role do usuário
 * @param contextos Contextos fornecidos
 * @throws BadRequestException se contextos obrigatórios estiverem faltando
 */
export function validarContextosPorRole(
  role: string,
  contextos: Array<{
    modulo: string;
    quinzenaId?: string | null;
    etapaId?: string | null;
    turmaId?: string | null;
    professoraId?: string | null;
  }>,
): void {
  // Todos os contextos devem ter módulo
  const contextosInvalidos = contextos.filter((c) => !c.modulo);
  if (contextosInvalidos.length > 0) {
    throw new BadRequestException(
      "Todos os contextos devem ter um módulo definido",
    );
  }

  // Validação específica por role
  if (role === "professora") {
    // Professora precisa de modulo e quinzenaId
    const camposFaltando = contextos.filter((c) => !c.modulo || !c.quinzenaId);
    if (camposFaltando.length > 0) {
      throw new BadRequestException(
        "Professoras devem fornecer módulo e quinzenaId em todos os contextos",
      );
    }
  } else if (
    role === "analista_pedagogico" ||
    role.startsWith("coordenadora_") ||
    role === "gerente_unidade" ||
    role === "gerente_financeiro" ||
    role === "diretora_geral"
  ) {
    // Gestores precisam de todos os campos exceto master
    const camposFaltando = contextos.filter(
      (c) =>
        !c.modulo ||
        !c.quinzenaId ||
        !c.etapaId ||
        !c.turmaId ||
        !c.professoraId,
    );
    if (camposFaltando.length > 0) {
      throw new BadRequestException(
        "Gestores devem fornecer módulo, quinzenaId, etapaId, turmaId e professoraId em todos os contextos",
      );
    }
  } else if (role === "master") {
    // Master só precisa de módulo (já validado acima)
    // Nenhuma validação adicional necessária
  } else {
    throw new BadRequestException(`Role não reconhecida: ${role}`);
  }
}

/**
 * Calcula prioridade automática baseada no prazo.
 *
 * @remarks
 * Esta função será utilizada na Task 10 quando implementarmos
 * a criação automática de tarefas via eventos do sistema
 * (ex: planejamento reprovado, prazo próximo do vencimento).
 *
 * @param prazo Data de prazo da tarefa
 * @returns Prioridade calculada (ALTA, MEDIA, BAIXA)
 */
export function calcularPrioridadeAutomatica(prazo: Date): TarefaPrioridade {
  const agora = new Date();
  const diffMs = prazo.getTime() - agora.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias <= 1) {
    return "ALTA";
  } else if (diffDias <= 3) {
    return "MEDIA";
  } else {
    return "BAIXA";
  }
}
