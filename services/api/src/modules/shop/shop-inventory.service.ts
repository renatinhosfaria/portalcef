import {
  Injectable,
  ConflictException,
  BadRequestException,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import {
  getDb,
  shopInventory,
  shopInventoryLedger,
  eq,
  and,
  desc,
} from "@essencia/db";

/**
 * ShopInventoryService
 *
 * Gestão de estoque com Redis locks para operações atômicas
 * Implementa reserva, confirmação, liberação e auditoria completa via ledger
 */
@Injectable()
export class ShopInventoryService implements OnModuleDestroy {
  private redis: Redis;
  private readonly LOCK_TTL = 60; // 60 segundos - suficiente para transação + Stripe

  constructor(private configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";
    this.redis = new Redis(redisUrl);
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  /**
   * Adquire lock Redis para operação atômica de estoque
   * Usa SETNX com TTL para evitar deadlocks
   */
  private async acquireLock(
    variantId: string,
    unitId: string,
  ): Promise<boolean> {
    const lockKey = `shop:inventory:lock:${variantId}:${unitId}`;
    const result = await this.redis.set(
      lockKey,
      "1",
      "EX",
      this.LOCK_TTL,
      "NX",
    );
    return result === "OK";
  }

  /**
   * Libera lock Redis
   */
  private async releaseLock(variantId: string, unitId: string): Promise<void> {
    const lockKey = `shop:inventory:lock:${variantId}:${unitId}`;
    await this.redis.del(lockKey);
  }

  /**
   * Busca ou cria entrada de inventário
   */
  private async getOrCreateInventory(variantId: string, unitId: string) {
    const db = getDb();

    let inventory = await db.query.shopInventory.findFirst({
      where: and(
        eq(shopInventory.variantId, variantId),
        eq(shopInventory.unitId, unitId),
      ),
    });

    // Se não existe, cria com estoque zero
    if (!inventory) {
      const [created] = await db
        .insert(shopInventory)
        .values({
          variantId,
          unitId,
          quantity: 0,
          reservedQuantity: 0,
          lowStockThreshold: 5,
        })
        .returning();
      inventory = created;
    }

    return inventory;
  }

  /**
   * GET /shop/admin/inventory/:variantId/:unitId
   *
   * Retorna status atual do estoque
   */
  async getInventory(variantId: string, unitId: string) {
    const inventory = await this.getOrCreateInventory(variantId, unitId);

    return {
      variantId: inventory.variantId,
      unitId: inventory.unitId,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      available: Math.max(0, inventory.quantity - inventory.reservedQuantity),
      lowStockThreshold: inventory.lowStockThreshold,
      updatedAt: inventory.updatedAt,
    };
  }

  /**
   * Reserva estoque atomicamente com Redis lock
   * Usado ao criar pedido (antes do pagamento)
   */
  async reserveStock(
    variantId: string,
    unitId: string,
    quantity: number,
    orderId: string,
  ) {
    const db = getDb();

    // Tentar adquirir lock (retry até 3x com delay de 100ms)
    let lockAcquired = false;
    for (let i = 0; i < 3; i++) {
      lockAcquired = await this.acquireLock(variantId, unitId);
      if (lockAcquired) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!lockAcquired) {
      throw new ConflictException({
        code: "CONFLICT",
        message:
          "Estoque sendo atualizado por outra operação. Tente novamente.",
      });
    }

    try {
      const inventory = await this.getOrCreateInventory(variantId, unitId);
      const available = inventory.quantity - inventory.reservedQuantity;

      if (available < quantity) {
        throw new BadRequestException({
          code: "INSUFFICIENT_STOCK",
          message: `Estoque insuficiente. Disponível: ${available}, solicitado: ${quantity}`,
        });
      }

      // Incrementa reservedQuantity
      await db
        .update(shopInventory)
        .set({
          reservedQuantity: inventory.reservedQuantity + quantity,
          updatedAt: new Date(),
        })
        .where(eq(shopInventory.id, inventory.id));

      // Cria ledger entry
      await db.insert(shopInventoryLedger).values({
        inventoryId: inventory.id,
        movementType: "RESERVA",
        quantityChange: -quantity, // Negativo pois reduziu disponível
        referenceId: orderId,
        notes: `Reserva para pedido ${orderId}`,
        createdBy: null,
      });

      return { success: true, reserved: quantity };
    } finally {
      await this.releaseLock(variantId, unitId);
    }
  }

  /**
   * Confirma venda (converte RESERVA em VENDA_ONLINE)
   * Chamado quando pagamento é confirmado via webhook Stripe
   */
  async confirmSale(
    variantId: string,
    unitId: string,
    quantity: number,
    orderId: string,
  ) {
    const db = getDb();
    const lockAcquired = await this.acquireLock(variantId, unitId);

    if (!lockAcquired) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      const inventory = await this.getOrCreateInventory(variantId, unitId);

      // Decrementa quantity real e reservedQuantity
      await db
        .update(shopInventory)
        .set({
          quantity: inventory.quantity - quantity,
          reservedQuantity: inventory.reservedQuantity - quantity,
          updatedAt: new Date(),
        })
        .where(eq(shopInventory.id, inventory.id));

      // Cria ledger entry
      await db.insert(shopInventoryLedger).values({
        inventoryId: inventory.id,
        movementType: "VENDA_ONLINE",
        quantityChange: -quantity,
        referenceId: orderId,
        notes: `Venda online confirmada - pedido ${orderId}`,
        createdBy: null,
      });

      return { success: true, confirmed: quantity };
    } finally {
      await this.releaseLock(variantId, unitId);
    }
  }

  /**
   * Confirma venda presencial (sem reserva prévia)
   * Apenas decrementa quantity, não mexe em reservedQuantity
   * Registra como VENDA_PRESENCIAL no ledger
   */
  async confirmPresentialSale(
    variantId: string,
    unitId: string,
    quantity: number,
    orderNumber: string,
    userId: string,
  ) {
    const db = getDb();
    const lockAcquired = await this.acquireLock(variantId, unitId);

    if (!lockAcquired) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      const inventory = await this.getOrCreateInventory(variantId, unitId);
      const available = inventory.quantity - inventory.reservedQuantity;

      if (available < quantity) {
        throw new BadRequestException({
          code: "INSUFFICIENT_STOCK",
          message: `Estoque insuficiente. Disponível: ${available}, solicitado: ${quantity}`,
        });
      }

      // Decrementa APENAS quantity (venda presencial não tem reserva)
      await db
        .update(shopInventory)
        .set({
          quantity: inventory.quantity - quantity,
          updatedAt: new Date(),
        })
        .where(eq(shopInventory.id, inventory.id));

      // Cria ledger entry como VENDA_PRESENCIAL
      await db.insert(shopInventoryLedger).values({
        inventoryId: inventory.id,
        movementType: "VENDA_PRESENCIAL",
        quantityChange: -quantity,
        referenceId: orderNumber,
        notes: `Venda presencial - pedido ${orderNumber}`,
        createdBy: userId,
      });

      return { success: true, confirmed: quantity };
    } finally {
      await this.releaseLock(variantId, unitId);
    }
  }

  /**
   * Libera reserva (quando pagamento expira ou falha)
   */
  async releaseReservation(
    variantId: string,
    unitId: string,
    quantity: number,
    orderId: string,
  ) {
    const db = getDb();
    const lockAcquired = await this.acquireLock(variantId, unitId);

    if (!lockAcquired) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      const inventory = await this.getOrCreateInventory(variantId, unitId);

      // Decrementa reservedQuantity (libera para novos pedidos)
      await db
        .update(shopInventory)
        .set({
          reservedQuantity: Math.max(0, inventory.reservedQuantity - quantity),
          updatedAt: new Date(),
        })
        .where(eq(shopInventory.id, inventory.id));

      // Cria ledger entry
      await db.insert(shopInventoryLedger).values({
        inventoryId: inventory.id,
        movementType: "LIBERACAO",
        quantityChange: quantity, // Positivo pois voltou a ficar disponível
        referenceId: orderId,
        notes: `Reserva liberada - pedido ${orderId}`,
        createdBy: null,
      });

      return { success: true, released: quantity };
    } finally {
      await this.releaseLock(variantId, unitId);
    }
  }

  /**
   * POST /shop/admin/inventory/entry
   *
   * Adiciona estoque (ENTRADA)
   */
  async addStock(
    variantId: string,
    unitId: string,
    quantity: number,
    notes: string,
    userId: string,
  ) {
    const db = getDb();
    const lockAcquired = await this.acquireLock(variantId, unitId);

    if (!lockAcquired) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      const inventory = await this.getOrCreateInventory(variantId, unitId);

      // Incrementa quantity
      await db
        .update(shopInventory)
        .set({
          quantity: inventory.quantity + quantity,
          updatedAt: new Date(),
        })
        .where(eq(shopInventory.id, inventory.id));

      // Cria ledger entry
      await db.insert(shopInventoryLedger).values({
        inventoryId: inventory.id,
        movementType: "ENTRADA",
        quantityChange: quantity,
        referenceId: null,
        notes: notes || "Entrada de estoque",
        createdBy: userId,
      });

      return {
        success: true,
        newQuantity: inventory.quantity + quantity,
        added: quantity,
      };
    } finally {
      await this.releaseLock(variantId, unitId);
    }
  }

  /**
   * POST /shop/admin/inventory/adjust
   *
   * Ajusta estoque (positivo ou negativo)
   */
  async adjustStock(
    variantId: string,
    unitId: string,
    quantityChange: number,
    notes: string,
    userId: string,
  ) {
    const db = getDb();
    const lockAcquired = await this.acquireLock(variantId, unitId);

    if (!lockAcquired) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      const inventory = await this.getOrCreateInventory(variantId, unitId);
      const newQuantity = Math.max(0, inventory.quantity + quantityChange);

      // Atualiza quantity
      await db
        .update(shopInventory)
        .set({
          quantity: newQuantity,
          updatedAt: new Date(),
        })
        .where(eq(shopInventory.id, inventory.id));

      // Cria ledger entry
      await db.insert(shopInventoryLedger).values({
        inventoryId: inventory.id,
        movementType: "AJUSTE",
        quantityChange,
        referenceId: null,
        notes: notes || "Ajuste manual de estoque",
        createdBy: userId,
      });

      return {
        success: true,
        previousQuantity: inventory.quantity,
        newQuantity,
        change: quantityChange,
      };
    } finally {
      await this.releaseLock(variantId, unitId);
    }
  }

  /**
   * GET /shop/admin/inventory/ledger/:variantId/:unitId
   *
   * Retorna histórico de movimentações
   */
  async getInventoryLedger(variantId: string, unitId: string) {
    const db = getDb();

    const inventory = await this.getOrCreateInventory(variantId, unitId);

    const ledger = await db.query.shopInventoryLedger.findMany({
      where: eq(shopInventoryLedger.inventoryId, inventory.id),
      orderBy: [desc(shopInventoryLedger.createdAt)],
      limit: 100, // ?ltimas 100 movimenta??es
    });

    return ledger.map((entry: typeof shopInventoryLedger.$inferSelect) => ({
      id: entry.id,
      movementType: entry.movementType,
      quantityChange: entry.quantityChange,
      referenceId: entry.referenceId,
      notes: entry.notes,
      createdBy: entry.createdBy,
      createdAt: entry.createdAt,
    }));
  }

  /**
   * POST /shop/admin/inventory/exit
   *
   * Remove estoque manualmente (SAIDA)
   */
  async removeStock(
    variantId: string,
    unitId: string,
    quantity: number,
    notes: string,
    reason: "VENDA_BALCAO" | "DANO" | "PERDA" | "AMOSTRA" | "OUTROS",
    userId: string,
  ) {
    const db = getDb();
    const lockAcquired = await this.acquireLock(variantId, unitId);

    if (!lockAcquired) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      const inventory = await this.getOrCreateInventory(variantId, unitId);
      const available = inventory.quantity - inventory.reservedQuantity;

      if (available < quantity) {
        throw new BadRequestException({
          code: "INSUFFICIENT_STOCK",
          message: `Estoque disponível insuficiente. Disponível: ${available}, solicitado: ${quantity}`,
        });
      }

      // Decrementa quantity
      const newQuantity = inventory.quantity - quantity;
      await db
        .update(shopInventory)
        .set({
          quantity: newQuantity,
          updatedAt: new Date(),
        })
        .where(eq(shopInventory.id, inventory.id));

      // Cria ledger entry
      await db.insert(shopInventoryLedger).values({
        inventoryId: inventory.id,
        movementType: `SAIDA_${reason}`,
        quantityChange: -quantity,
        referenceId: null,
        notes: notes || `Saída manual - ${reason}`,
        createdBy: userId,
      });

      return {
        success: true,
        previousQuantity: inventory.quantity,
        newQuantity,
        removed: quantity,
      };
    } finally {
      await this.releaseLock(variantId, unitId);
    }
  }
}
