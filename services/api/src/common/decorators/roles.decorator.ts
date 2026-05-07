import { SetMetadata } from "@nestjs/common";

export const ROLES_KEY = "roles";
export const EXACT_ROLES_KEY = "roles:exact";

/**
 * Decorator para especificar quais roles podem acessar uma rota.
 * @example @Roles('admin', 'teacher')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Exige correspondência exata com a lista de roles declarada em @Roles.
 * Sem este decorator, o RolesGuard mantém a hierarquia global existente.
 */
export const ExactRoles = () => SetMetadata(EXACT_ROLES_KEY, true);
