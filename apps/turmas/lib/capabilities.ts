const ROLES_ADMINISTRATIVAS = new Set([
  "master",
  "diretora_geral",
  "gerente_unidade",
]);

const ROLES_PROFESSORA = new Set([
  ...ROLES_ADMINISTRATIVAS,
  "coordenadora_geral",
]);

export interface TurmaCapabilities {
  canEdit: boolean;
  canArchive: boolean;
  canManageProfessora: boolean;
}

export function getTurmaCapabilities(
  role: string | null | undefined,
): TurmaCapabilities {
  return {
    canEdit: ROLES_ADMINISTRATIVAS.has(role ?? ""),
    canArchive: ROLES_ADMINISTRATIVAS.has(role ?? ""),
    canManageProfessora: ROLES_PROFESSORA.has(role ?? ""),
  };
}
