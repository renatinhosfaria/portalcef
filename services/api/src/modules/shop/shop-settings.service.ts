import { Injectable, Logger } from "@nestjs/common";
import { getDb, shopSettings, eq } from "@essencia/db";

export interface UpdateSettingsDto {
  maxInstallments?: number;
  isShopEnabled?: boolean;
  pickupInstructions?: string | null;
}

@Injectable()
export class ShopSettingsService {
  private readonly logger = new Logger(ShopSettingsService.name);

  /**
   * Busca configurações de uma unidade
   * Se não existir, cria com valores padrão
   */
  async getSettings(unitId: string) {
    const db = getDb();
    this.logger.log(`Fetching settings for unit: ${unitId}`);

    let settings = await db.query.shopSettings.findFirst({
      where: eq(shopSettings.unitId, unitId),
    });

    // Se não existe, criar com defaults
    if (!settings) {
      this.logger.log(`Creating default settings for unit: ${unitId}`);
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
    }

    return settings;
  }

  /**
   * Atualiza configurações de uma unidade
   */
  async updateSettings(unitId: string, dto: UpdateSettingsDto, userId: string) {
    const db = getDb();
    this.logger.log(`Updating settings for unit: ${unitId} by user: ${userId}`);

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
