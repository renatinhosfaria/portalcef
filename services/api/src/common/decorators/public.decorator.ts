import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Marca a rota como pública, pulando AuthGuard e RolesGuard.
 * Útil para endpoints server-to-server (ex: OnlyOffice download/callback).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
