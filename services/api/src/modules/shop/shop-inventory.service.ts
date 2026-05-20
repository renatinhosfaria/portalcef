import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { randomUUID } from "node:crypto";
import {
  getDb,
  shopInventory,
  shopInventoryLedger,
  shopProductVariants,
  units,
  eq,
  and,
  desc,
} from "@essencia/db";
import {
  assertShopTenantScope,
  isMasterShopScope,
  type ShopTenantScope,
} from "./shop-tenant-scope";

type Db = ReturnType<typeof getDb>;
type DbTransaction = Parameters<Db["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;
type DbExecutor = Db | DbTransaction;
type InventoryLockTarget = { variantId: string; unitId: string };

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
  private inventoryLockKey(variantId: string, unitId: string): string {
    return `shop:inventory:lock:${variantId}:${unitId}`;
  }

  private async acquireNamedLock(lockKey: string): Promise<string | null> {
    const token = randomUUID();
    const result = await this.redis.set(
      lockKey,
      token,
      "EX",
      this.LOCK_TTL,
      "NX",
    );
    return result === "OK" ? token : null;
  }

  private async releaseNamedLock(
    lockKey: string,
    token: string,
  ): Promise<void> {
    await this.redis.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      1,
      lockKey,
      token,
    );
  }

  private async acquireLock(
    variantId: string,
    unitId: string,
  ): Promise<string | null> {
    return this.acquireNamedLock(this.inventoryLockKey(variantId, unitId));
  }

  /**
   * Libera lock Redis
   */
  private async releaseLock(
    variantId: string,
    unitId: string,
    token: string,
  ): Promise<void> {
    await this.releaseNamedLock(this.inventoryLockKey(variantId, unitId), token);
  }

  async withInventoryLocks<T>(
    targets: InventoryLockTarget[],
    callback: () => Promise<T>,
  ): Promise<T> {
    const lockKeys = Array.from(
      new Set(
        targets.map((target) =>
          this.inventoryLockKey(target.variantId, target.unitId),
        ),
      ),
    ).sort();
    const acquired: Array<{ lockKey: string; token: string }> = [];

    try {
      for (const lockKey of lockKeys) {
        let token: string | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          token = await this.acquireNamedLock(lockKey);
          if (token) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        if (!token) {
          throw new ConflictException({
            code: "CONFLICT",
            message:
              "Estoque sendo atualizado por outra operação. Tente novamente.",
          });
        }

        acquired.push({ lockKey, token });
      }

      return await callback();
    } finally {
      for (const { lockKey, token } of acquired.reverse()) {
        await this.releaseNamedLock(lockKey, token);
      }
    }
  }

  async withOrderLock<T>(
    orderId: string,
    callback: () => Promise<T>,
  ): Promise<T> {
    const lockKey = `shop:orders:lock:${orderId}`;
    const token = await this.acquireNamedLock(lockKey);

    if (!token) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Pedido sendo atualizado. Tente novamente.",
      });
    }

    try {
      return await callback();
    } finally {
      await this.releaseNamedLock(lockKey, token);
    }
  }

  /**
   * Busca ou cria entrada de inventário
   */
  private async getOrCreateInventory(
    variantId: string,
    unitId: string,
    db: DbExecutor = getDb(),
  ) {
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

  private async getExistingInventory(
    variantId: string,
    unitId: string,
    db: DbExecutor = getDb(),
  ) {
    const inventory = await db.query.shopInventory.findFirst({
      where: and(
        eq(shopInventory.variantId, variantId),
        eq(shopInventory.unitId, unitId),
      ),
    });

    if (!inventory) {
      throw new BadRequestException({
        code: "INSUFFICIENT_STOCK",
        message: "Estoque indisponível para esta unidade",
        details: {
          variantId,
          availableStock: 0,
        },
      });
    }

    return inventory;
  }

  private async assertInventoryScope(
    variantId: string,
    unitId: string,
    scope?: ShopTenantScope,
  ) {
    if (isMasterShopScope(scope)) {
      return;
    }

    assertShopTenantScope(scope);
    const scopedTenant = scope!;

    if (scopedTenant.unitId && scopedTenant.unitId !== unitId) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Estoque não encontrado",
      });
    }

    const db = getDb();
    const [variant, unit] = await Promise.all([
      db.query.shopProductVariants.findFirst({
        where: eq(shopProductVariants.id, variantId),
        with: {
          product: true,
        },
      }),
      db.query.units.findFirst({
        where: and(
          eq(units.id, unitId),
          eq(units.schoolId, scopedTenant.schoolId!),
        ),
      }),
    ]);

    if (
      !variant?.product ||
      variant.product.schoolId !== scopedTenant.schoolId ||
      !unit
    ) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Estoque não encontrado",
      });
    }
  }

  /**
   * GET /shop/admin/inventory/:variantId/:unitId
   *
   * Retorna status atual do estoque
   */
  async getInventory(
    variantId: string,
    unitId: string,
    scope?: ShopTenantScope,
  ) {
    await this.assertInventoryScope(variantId, unitId, scope);
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
    // Tentar adquirir lock (retry até 3x com delay de 100ms)
    let lockToken: string | null = null;
    for (let i = 0; i < 3; i++) {
      lockToken = await this.acquireLock(variantId, unitId);
      if (lockToken) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!lockToken) {
      throw new ConflictException({
        code: "CONFLICT",
        message:
          "Estoque sendo atualizado por outra operação. Tente novamente.",
      });
    }

    try {
      return await this.reserveStockInTransaction(
        variantId,
        unitId,
        quantity,
        orderId,
        getDb(),
      );
    } finally {
      await this.releaseLock(variantId, unitId, lockToken);
    }
  }

  async reserveStockInTransaction(
    variantId: string,
    unitId: string,
    quantity: number,
    orderId: string,
    db: DbExecutor,
  ) {
    const inventory = await this.getExistingInventory(variantId, unitId, db);
    const available = inventory.quantity - inventory.reservedQuantity;

    if (available < quantity) {
      throw new BadRequestException({
        code: "INSUFFICIENT_STOCK",
        message: `Estoque insuficiente. Disponível: ${available}, solicitado: ${quantity}`,
        details: {
          variantId,
          availableStock: available,
        },
      });
    }

    await db
      .update(shopInventory)
      .set({
        reservedQuantity: inventory.reservedQuantity + quantity,
        updatedAt: new Date(),
      })
      .where(eq(shopInventory.id, inventory.id));

    await db.insert(shopInventoryLedger).values({
      inventoryId: inventory.id,
      movementType: "RESERVA",
      quantityChange: -quantity,
      referenceId: orderId,
      notes: `Reserva para pedido ${orderId}`,
      createdBy: null,
    });

    return { success: true, reserved: quantity };
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
    const lockToken = await this.acquireLock(variantId, unitId);

    if (!lockToken) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      return await this.confirmSaleInTransaction(
        variantId,
        unitId,
        quantity,
        orderId,
        getDb(),
      );
    } finally {
      await this.releaseLock(variantId, unitId, lockToken);
    }
  }

  async confirmSaleInTransaction(
    variantId: string,
    unitId: string,
    quantity: number,
    orderId: string,
    db: DbExecutor,
  ) {
    const inventory = await this.getExistingInventory(variantId, unitId, db);

    if (inventory.reservedQuantity < quantity || inventory.quantity < quantity) {
      throw new BadRequestException({
        code: "INSUFFICIENT_STOCK",
        message: "Reserva insuficiente para confirmar a venda",
        details: {
          variantId,
          availableStock: inventory.quantity - inventory.reservedQuantity,
        },
      });
    }

    await db
      .update(shopInventory)
      .set({
        quantity: inventory.quantity - quantity,
        reservedQuantity: inventory.reservedQuantity - quantity,
        updatedAt: new Date(),
      })
      .where(eq(shopInventory.id, inventory.id));

    await db.insert(shopInventoryLedger).values({
      inventoryId: inventory.id,
      movementType: "VENDA_ONLINE",
      quantityChange: -quantity,
      referenceId: orderId,
      notes: `Venda online confirmada - pedido ${orderId}`,
      createdBy: null,
    });

    return { success: true, confirmed: quantity };
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
    const lockToken = await this.acquireLock(variantId, unitId);

    if (!lockToken) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      return await this.confirmPresentialSaleInTransaction(
        variantId,
        unitId,
        quantity,
        orderNumber,
        userId,
        getDb(),
      );
    } finally {
      await this.releaseLock(variantId, unitId, lockToken);
    }
  }

  async confirmPresentialSaleInTransaction(
    variantId: string,
    unitId: string,
    quantity: number,
    orderNumber: string,
    userId: string,
    db: DbExecutor,
  ) {
    const inventory = await this.getExistingInventory(variantId, unitId, db);
    const available = inventory.quantity - inventory.reservedQuantity;

    if (available < quantity) {
      throw new BadRequestException({
        code: "INSUFFICIENT_STOCK",
        message: `Estoque insuficiente. Disponível: ${available}, solicitado: ${quantity}`,
        details: {
          variantId,
          availableStock: available,
        },
      });
    }

    await db
      .update(shopInventory)
      .set({
        quantity: inventory.quantity - quantity,
        updatedAt: new Date(),
      })
      .where(eq(shopInventory.id, inventory.id));

    await db.insert(shopInventoryLedger).values({
      inventoryId: inventory.id,
      movementType: "VENDA_PRESENCIAL",
      quantityChange: -quantity,
      referenceId: orderNumber,
      notes: `Venda presencial - pedido ${orderNumber}`,
      createdBy: userId,
    });

    return { success: true, confirmed: quantity };
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
    const lockToken = await this.acquireLock(variantId, unitId);

    if (!lockToken) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      return await db.transaction(async (tx: DbTransaction) =>
        this.releaseReservationInTransaction(
          variantId,
          unitId,
          quantity,
          orderId,
          tx,
        ),
      );
    } finally {
      await this.releaseLock(variantId, unitId, lockToken);
    }
  }

  async releaseReservationInTransaction(
    variantId: string,
    unitId: string,
    quantity: number,
    orderId: string,
    db: DbExecutor,
  ) {
    const inventory = await this.getExistingInventory(variantId, unitId, db);

    if (inventory.reservedQuantity < quantity) {
      throw new BadRequestException({
        code: "INSUFFICIENT_RESERVATION",
        message: "Reserva insuficiente para liberação",
      });
    }

    await db
      .update(shopInventory)
      .set({
        reservedQuantity: inventory.reservedQuantity - quantity,
        updatedAt: new Date(),
      })
      .where(eq(shopInventory.id, inventory.id));

    await db.insert(shopInventoryLedger).values({
      inventoryId: inventory.id,
      movementType: "LIBERACAO",
      quantityChange: quantity,
      referenceId: orderId,
      notes: `Reserva liberada - pedido ${orderId}`,
      createdBy: null,
    });

    return { success: true, released: quantity };
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
    scope?: ShopTenantScope,
  ) {
    const db = getDb();
    await this.assertInventoryScope(variantId, unitId, scope);
    const lockToken = await this.acquireLock(variantId, unitId);

    if (!lockToken) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      return await db.transaction((tx: DbTransaction) =>
        this.addStockInTransaction(
          variantId,
          unitId,
          quantity,
          notes,
          userId,
          tx,
        ),
      );
    } finally {
      await this.releaseLock(variantId, unitId, lockToken);
    }
  }

  async addStockInTransaction(
    variantId: string,
    unitId: string,
    quantity: number,
    notes: string,
    userId: string,
    db: DbExecutor,
    scope?: ShopTenantScope,
  ) {
    if (scope) {
      await this.assertInventoryScope(variantId, unitId, scope);
    }

    const inventory = await this.getOrCreateInventory(variantId, unitId, db);

    await db
      .update(shopInventory)
      .set({
        quantity: inventory.quantity + quantity,
        updatedAt: new Date(),
      })
      .where(eq(shopInventory.id, inventory.id));

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
    scope?: ShopTenantScope,
  ) {
    const db = getDb();
    await this.assertInventoryScope(variantId, unitId, scope);
    const lockToken = await this.acquireLock(variantId, unitId);

    if (!lockToken) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      return await db.transaction(async (tx: DbTransaction) => {
        const inventory = await this.getOrCreateInventory(variantId, unitId, tx);
        const newQuantity = inventory.quantity + quantityChange;

        if (newQuantity < inventory.reservedQuantity) {
          throw new BadRequestException({
            code: "INVALID_STOCK_ADJUSTMENT",
            message:
              "Ajuste inválido: o estoque total não pode ficar menor que a quantidade reservada",
          });
        }

        await tx
          .update(shopInventory)
          .set({
            quantity: newQuantity,
            updatedAt: new Date(),
          })
          .where(eq(shopInventory.id, inventory.id));

        await tx.insert(shopInventoryLedger).values({
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
      });
    } finally {
      await this.releaseLock(variantId, unitId, lockToken);
    }
  }

  /**
   * GET /shop/admin/inventory/ledger/:variantId/:unitId
   *
   * Retorna histórico de movimentações
   */
  async getInventoryLedger(
    variantId: string,
    unitId: string,
    scope?: ShopTenantScope,
  ) {
    const db = getDb();
    await this.assertInventoryScope(variantId, unitId, scope);

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
    scope?: ShopTenantScope,
  ) {
    const db = getDb();
    await this.assertInventoryScope(variantId, unitId, scope);
    const lockToken = await this.acquireLock(variantId, unitId);

    if (!lockToken) {
      throw new ConflictException({
        code: "CONFLICT",
        message: "Estoque sendo atualizado. Tente novamente.",
      });
    }

    try {
      return await db.transaction(async (tx: DbTransaction) => {
        const inventory = await this.getOrCreateInventory(variantId, unitId, tx);
        const available = inventory.quantity - inventory.reservedQuantity;

        if (available < quantity) {
          throw new BadRequestException({
            code: "INSUFFICIENT_STOCK",
            message: `Estoque disponível insuficiente. Disponível: ${available}, solicitado: ${quantity}`,
            details: {
              variantId,
              availableStock: available,
            },
          });
        }

        const newQuantity = inventory.quantity - quantity;
        await tx
          .update(shopInventory)
          .set({
            quantity: newQuantity,
            updatedAt: new Date(),
          })
          .where(eq(shopInventory.id, inventory.id));

        await tx.insert(shopInventoryLedger).values({
          inventoryId: inventory.id,
          movementType: "AJUSTE",
          quantityChange: -quantity,
          referenceId: null,
          notes: `${notes || "Saída manual"} - Motivo: ${reason}`,
          createdBy: userId,
        });

        return {
          success: true,
          previousQuantity: inventory.quantity,
          newQuantity,
          removed: quantity,
        };
      });
    } finally {
      await this.releaseLock(variantId, unitId, lockToken);
    }
  }
}
