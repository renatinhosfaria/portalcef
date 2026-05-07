import { NotFoundException } from "@nestjs/common";

export interface ShopTenantScope {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
}

export interface ShopUserContext {
  userId: string;
  role: string;
  schoolId: string | null;
  unitId: string | null;
}

export function createShopTenantScope(user: ShopUserContext): ShopTenantScope {
  return {
    userId: user.userId,
    role: user.role,
    schoolId: user.schoolId,
    unitId: user.unitId,
  };
}

export function isMasterShopScope(scope?: ShopTenantScope | null): boolean {
  return scope?.role === "master";
}

const UNIT_SCOPED_SHOP_ROLES = new Set([
  "gerente_unidade",
  "gerente_financeiro",
  "auxiliar_administrativo",
]);

export function isUnitScopedShopScope(
  scope?: ShopTenantScope | null,
): boolean {
  return !!scope?.role && UNIT_SCOPED_SHOP_ROLES.has(scope.role);
}

export function assertShopTenantScope(scope?: ShopTenantScope | null): void {
  if (isMasterShopScope(scope)) {
    return;
  }

  if (!scope?.schoolId || (isUnitScopedShopScope(scope) && !scope.unitId)) {
    throw new NotFoundException({
      code: "RESOURCE_NOT_FOUND",
      message: "Recurso não encontrado",
    });
  }
}

export function canAccessShopSchool(
  scope: ShopTenantScope | undefined | null,
  schoolId: string,
): boolean {
  return (
    isMasterShopScope(scope) ||
    (!!scope?.schoolId && scope.schoolId === schoolId)
  );
}

export function canAccessShopUnit(
  scope: ShopTenantScope | undefined | null,
  unitId: string,
): boolean {
  if (isMasterShopScope(scope)) {
    return true;
  }

  if (!scope) {
    return false;
  }

  if (!scope.schoolId) {
    return false;
  }

  if (isUnitScopedShopScope(scope)) {
    return scope.unitId === unitId;
  }

  return !scope.unitId || scope.unitId === unitId;
}
