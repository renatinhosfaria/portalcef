import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { getDb, shopSettings, units, eq, and } from "@essencia/db";
import {
  assertShopTenantScope,
  isMasterShopScope,
  type ShopTenantScope,
} from "./shop-tenant-scope";

export interface UpdateSettingsDto {
  maxInstallments?: number;
  isShopEnabled?: boolean;
  pickupInstructions?: string | null;
}

@Injectable()
export class ShopSettingsService {
  private readonly logger = new Logger(ShopSettingsService.name);

  private async assertSettingsScope(unitId: string, scope?: ShopTenantScope) {
    if (isMasterShopScope(scope)) {
      return;
    }

    assertShopTenantScope(scope);
    const scopedTenant = scope!;

    if (scopedTenant.unitId && scopedTenant.unitId !== unitId) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Configurações não encontradas",
      });
    }

    const db = getDb();
    const unit = await db.query.units.findFirst({
      where: and(
        eq(units.id, unitId),
        eq(units.schoolId, scopedTenant.schoolId!),
      ),
    });

    if (!unit) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Configurações não encontradas",
      });
    }
  }

  /**
   * Busca configurações de uma unidade
   * Se não existir, cria com valores padrão
   */
  async getSettings(unitId: string, scope?: ShopTenantScope) {
    try {
      const db = getDb();
      await this.assertSettingsScope(unitId, scope);

      let settings = await db.query.shopSettings.findFirst({
        where: eq(shopSettings.unitId, unitId),
      });

      // Se não existe, criar com defaults
      if (!settings) {
        try {
          const [newSettings] = await db
            .insert(shopSettings)
            .values({
              unitId,
              maxInstallments: 1,
              isShopEnabled: true,
              pickupInstructions:
                "Retirada na secretaria, de segunda a sexta, das 8h às 17h.",
            })
            .returning();

          settings = newSettings;
        } catch (error) {
          this.logger.error(
            `Falha ao criar configurações padrão da loja: ${error}`,
            (error as Error).stack,
          );
          // Tentar buscar novamente em caso de race condition
          settings = await db.query.shopSettings.findFirst({
            where: eq(shopSettings.unitId, unitId),
          });
        }
      }

      return settings;
    } catch (e) {
      this.logger.error(
        `Erro ao buscar configurações da loja: ${e}`,
        (e as Error).stack,
      );
      throw e;
    }
  }

  /**
   * Atualiza configurações de uma unidade
   */
  async updateSettings(
    unitId: string,
    dto: UpdateSettingsDto,
    userId: string,
    scope?: ShopTenantScope,
  ) {
    const db = getDb();
    this.logger.log(`Updating settings for unit: ${unitId} by user: ${userId}`);
    await this.assertSettingsScope(unitId, scope);

    // Garantir que existe
    const existing = await db.query.shopSettings.findFirst({
      where: eq(shopSettings.unitId, unitId),
    });

    if (!existing) {
      // Criar se não existir
      const [newSettings] = await db
        .insert(shopSettings)
        .values({
          unitId,
          maxInstallments: dto.maxInstallments ?? 1,
          isShopEnabled: dto.isShopEnabled ?? true,
          pickupInstructions: dto.pickupInstructions ?? null,
        })
        .returning();

      return newSettings;
    }

    // Atualizar
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (dto.maxInstallments !== undefined) {
      updateData.maxInstallments = dto.maxInstallments;
    }
    if (dto.isShopEnabled !== undefined) {
      updateData.isShopEnabled = dto.isShopEnabled;
    }
    if (dto.pickupInstructions !== undefined) {
      updateData.pickupInstructions = dto.pickupInstructions;
    }

    const [updated] = await db
      .update(shopSettings)
      .set(updateData)
      .where(eq(shopSettings.unitId, unitId))
      .returning();

    this.logger.log(`Settings updated for unit: ${unitId}`);

    return updated;
  }
}
