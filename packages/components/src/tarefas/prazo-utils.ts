import { differenceInDays } from "date-fns";

/**
 * Calcula quantos dias restam até o prazo
 * @param prazo - Data do prazo em formato ISO 8601
 * @returns Número de dias restantes (negativo se atrasado)
 */
export function calcularDiasRestantes(prazo: string): number {
  const prazoDate = new Date(prazo);
  const hoje = new Date();
  return differenceInDays(prazoDate, hoje);
}

/**
 * Verifica se a tarefa está atrasada
 * @param prazo - Data do prazo em formato ISO 8601
 * @returns true se o prazo já passou
 */
export function isAtrasada(prazo: string): boolean {
  const prazoDate = new Date(prazo);
  return !Number.isNaN(prazoDate.getTime()) && prazoDate.getTime() < Date.now();
}

/**
 * Retorna a variante visual baseada no prazo
 * @param prazo - Data do prazo em formato ISO 8601
 * @returns Variante do badge: "default" | "warning" | "destructive"
 */
export function getPrazoVariant(
  prazo: string,
): "default" | "warning" | "destructive" {
  const dias = calcularDiasRestantes(prazo);

  if (isAtrasada(prazo)) {
    return "destructive"; // Atrasada
  }

  if (dias <= 1) {
    return "destructive"; // Urgente (hoje ou amanhã)
  }

  if (dias <= 3) {
    return "warning"; // Atenção (próximos 3 dias)
  }

  return "default"; // Normal
}
