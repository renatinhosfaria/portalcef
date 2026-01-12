import type { DeadlineStatus } from "./types";

/**
 * Retorna as classes CSS baseadas no status do deadline e se está bloqueada.
 */
export function getDeadlineColor(
  status: DeadlineStatus,
  isLocked: boolean,
): string {
  if (isLocked) return "bg-gray-100 border-gray-200 text-gray-400";

  switch (status) {
    case "late":
      return "bg-red-50 border-red-200 text-red-700";
    case "urgent":
      return "bg-yellow-50 border-yellow-200 text-yellow-700";
    case "warning":
      return "bg-green-50 border-green-200 text-green-700";
    case "normal":
      return "bg-blue-50 border-blue-200 text-blue-700";
    default:
      return "bg-gray-50 border-gray-200 text-gray-700";
  }
}
