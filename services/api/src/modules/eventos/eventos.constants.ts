export const EVENTOS_ADMIN_ROLES = ["master", "diretora_geral", "gerente_unidade", "auxiliar_administrativo"] as const;
export function hasEventosAdminAccess(role: string): boolean { return (EVENTOS_ADMIN_ROLES as readonly string[]).includes(role); }
export const EVENTOS_PUBLIC_STATUS = "PUBLICADO" as const;
