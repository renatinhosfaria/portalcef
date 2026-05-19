import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import {
  getDb,
  shopOrders,
  shopSettings,
  type ShopOrder,
  shopOrderItems,
  shopOrderPayments,
  type PaymentMethod,
  type ShopOrderPayment,
  type ShopOrderItem,
  shopProductVariants,
  type ShopProductVariant,
  shopInventory,
  units,
  eq,
  and,
  or,
  sql,
  desc,
  type ShopProduct,
} from "@essencia/db";
import { ShopInventoryService } from "./shop-inventory.service";
import { PaymentsService } from "../payments/payments.service";
import {
  CreateOrderDto,
  CreatePresentialSaleDto,
  ListOrdersDto,
} from "./dto/order.dto";
import {
  assertShopTenantScope,
  isMasterShopScope,
  type ShopTenantScope,
} from "./shop-tenant-scope";

type OrderItemWithPrice = {
  variantId: string;
  studentName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  productName: string;
  variantSize: string;
};

type PendingOrderResult = {
  order: ShopOrder;
  itemsWithPrice: OrderItemWithPrice[];
};

type Db = ReturnType<typeof getDb>;
type DbTransaction = Parameters<Db["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

type OrderItemVariant = ShopProductVariant & {
  product: ShopProduct;
  color?: string | null;
};

type OrderItemWithVariant = ShopOrderItem & {
  variant: OrderItemVariant;
};

type OrderWithItems = ShopOrder & {
  items: OrderItemWithVariant[];
  payments?: ShopOrderPayment[];
  updatedAt?: Date | null;
};

const LIMITE_PRE_VENDA_POR_PRODUTO_ALUNO = 2;

/**
 * ShopOrdersService
 *
 * Gerencia ciclo completo de pedidos:
 * - Criação com reserva de estoque
 * - Consulta por número + validação de telefone
 * - Listagem admin com filtros
 * - Vendas presenciais
 * - Cancelamento com liberação de estoque
 * - Retirada
 */
@Injectable()
export class ShopOrdersService {
  constructor(
    private inventoryService: ShopInventoryService,
    @Inject(forwardRef(() => PaymentsService))
    private paymentsService: PaymentsService,
  ) { }

  /**
   * Gera número de pedido único de 6 dígitos
   */
  private async generateOrderNumber(): Promise<string> {
    const db = getDb();
    let attempts = 0;

    while (attempts < 10) {
      const orderNumber = Math.floor(
        100000 + Math.random() * 900000,
      ).toString();

      const existing = await db.query.shopOrders.findFirst({
        where: eq(shopOrders.orderNumber, orderNumber),
      });

      if (!existing) return orderNumber;
      attempts++;
    }

    throw new Error("Failed to generate unique order number");
  }

  private orderWhere(orderId: string, scope?: ShopTenantScope) {
    if (isMasterShopScope(scope)) {
      return eq(shopOrders.id, orderId);
    }

    assertShopTenantScope(scope);
    const scopedTenant = scope!;
    const conditions = [
      eq(shopOrders.id, orderId),
      eq(shopOrders.schoolId, scopedTenant.schoolId!),
    ];

    if (scopedTenant.unitId) {
      conditions.push(eq(shopOrders.unitId, scopedTenant.unitId));
    }

    return and(...conditions);
  }

  private async assertUnitBelongsToSchool(schoolId: string, unitId: string) {
    const db = getDb();
    const unit = await db.query.units.findFirst({
      where: and(eq(units.id, unitId), eq(units.schoolId, schoolId)),
    });

    if (!unit) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Unidade não encontrada",
      });
    }
  }

  private async getPickupInstructions(unitId: string): Promise<string | null> {
    const db = getDb();
    const settings = await db.query.shopSettings.findFirst({
      where: eq(shopSettings.unitId, unitId),
    });

    return settings?.pickupInstructions ?? null;
  }

  private async assertShopEnabled(unitId: string) {
    const db = getDb();
    const settings = await db.query.shopSettings.findFirst({
      where: eq(shopSettings.unitId, unitId),
    });

    if (settings?.isShopEnabled === false) {
      throw new BadRequestException({
        code: "SHOP_DISABLED",
        message: "A loja desta unidade está temporariamente fechada",
      });
    }
  }

  private async getActiveVariantForOrder(variantId: string, schoolId: string) {
    const db = getDb();
    const variant = await db.query.shopProductVariants.findFirst({
      where: eq(shopProductVariants.id, variantId),
      with: { product: true },
    });

    if (
      !variant ||
      !variant.isActive ||
      !variant.product?.isActive ||
      variant.product.schoolId !== schoolId
    ) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: `Produto ou variante não encontrado: ${variantId}`,
      });
    }

    return variant;
  }

  private async getAvailableStock(variantId: string, unitId: string) {
    const db = getDb();
    const inventory = await db.query.shopInventory.findFirst({
      where: and(
        eq(shopInventory.variantId, variantId),
        eq(shopInventory.unitId, unitId),
      ),
    });

    if (!inventory) {
      return 0;
    }

    return inventory.quantity - inventory.reservedQuantity;
  }

  private async createPendingOnlineOrder(
    dto: CreateOrderDto,
    expiresAt: Date,
  ): Promise<PendingOrderResult> {
    const db = getDb();
    await this.assertUnitBelongsToSchool(dto.schoolId, dto.unitId);
    await this.assertShopEnabled(dto.unitId);

    const variantsById = new Map<
      string,
      Awaited<ReturnType<typeof this.getActiveVariantForOrder>>
    >();
    for (const item of dto.items) {
      variantsById.set(
        item.variantId,
        await this.getActiveVariantForOrder(item.variantId, dto.schoolId),
      );
    }

    const orderNumber = await this.generateOrderNumber();

    let totalAmount = 0;
    const itemsWithPrice: OrderItemWithPrice[] = [];

    for (const item of dto.items) {
      const variant = variantsById.get(item.variantId)!;
      const itemPrice = variant.priceOverride ?? variant.product.basePrice;
      const itemTotal = itemPrice * item.quantity;
      totalAmount += itemTotal;

      itemsWithPrice.push({
        variantId: item.variantId,
        studentName: item.studentName,
        quantity: item.quantity,
        unitPrice: itemPrice,
        subtotal: itemTotal,
        productName: variant.product.name,
        variantSize: variant.size,
      });
    }

    const lockTargets = dto.items.map((item) => ({
      variantId: item.variantId,
      unitId: dto.unitId,
    }));

    const order = await this.inventoryService.withInventoryLocks(
      lockTargets,
      async () =>
        db.transaction(async (tx: DbTransaction) => {
          const [createdOrder] = await tx
            .insert(shopOrders)
            .values({
              orderNumber,
              schoolId: dto.schoolId,
              unitId: dto.unitId,
              orderSource: "ONLINE",
              status: "AGUARDANDO_PAGAMENTO",
              totalAmount,
              customerName: dto.customerName,
              customerPhone: dto.customerPhone,
              customerEmail: dto.customerEmail || null,
              expiresAt,
            })
            .returning();

          for (const item of dto.items) {
            await this.inventoryService.reserveStockInTransaction(
              item.variantId,
              dto.unitId,
              item.quantity,
              createdOrder.id,
              tx,
            );
          }

          const orderItemsValues = itemsWithPrice.map((item) => ({
            orderId: createdOrder.id,
            variantId: item.variantId,
            studentName: item.studentName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }));

          await tx.insert(shopOrderItems).values(orderItemsValues);

          return createdOrder;
        }),
    );

    return { order, itemsWithPrice };
  }

  /**
   * POST /shop/orders
   *
   * Cria pedido de voucher presencial com reserva de estoque.
   */
  async createOrder(dto: CreateOrderDto) {
    // Voucher válido por 7 dias (cliente paga presencialmente na escola)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias
    const { order } = await this.createPendingOnlineOrder(dto, expiresAt);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      expiresAt: order.expiresAt,
    };
  }

  /**
   * POST /shop/orders/pre-venda
   *
   * Cria voucher de pré-venda sem reservar nem baixar estoque.
   * A escola confirma pagamento e retirada manualmente quando o produto chegar.
   */
  async createPreSaleOrder(dto: CreateOrderDto) {
    const db = getDb();
    await this.assertUnitBelongsToSchool(dto.schoolId, dto.unitId);
    await this.assertShopEnabled(dto.unitId);

    const orderNumber = await this.generateOrderNumber();
    const lockTargets = dto.items.map((item) => ({
      variantId: item.variantId,
      unitId: dto.unitId,
    }));

    const order = await this.inventoryService.withInventoryLocks(
      lockTargets,
      async () => {
        let totalAmount = 0;
        const itemsWithPrice: OrderItemWithPrice[] = [];
        const variantsById = new Map<
          string,
          Awaited<ReturnType<typeof this.getActiveVariantForOrder>>
        >();

        for (const item of dto.items) {
          variantsById.set(
            item.variantId,
            await this.getActiveVariantForOrder(item.variantId, dto.schoolId),
          );
        }

        const quantitiesByProductAndStudent = new Map<
          string,
          {
            productId: string;
            studentName: string;
            quantity: number;
          }
        >();

        for (const item of dto.items) {
          const variant = variantsById.get(item.variantId)!;
          const normalizedStudentName = item.studentName
            .trim()
            .toLocaleLowerCase("pt-BR");
          const key = `${variant.product.id}:${normalizedStudentName}`;
          const current = quantitiesByProductAndStudent.get(key) ?? {
            productId: variant.product.id,
            studentName: item.studentName,
            quantity: 0,
          };

          current.quantity += item.quantity;
          quantitiesByProductAndStudent.set(key, current);

          if (current.quantity > LIMITE_PRE_VENDA_POR_PRODUTO_ALUNO) {
            throw new BadRequestException({
              code: "QUANTITY_LIMIT_EXCEEDED",
              message:
                "Limite de 2 unidades por produto por aluno atingido na pré-venda.",
              details: {
                limit: LIMITE_PRE_VENDA_POR_PRODUTO_ALUNO,
                productId: current.productId,
                studentName: current.studentName,
                requestedQuantity: current.quantity,
              },
            });
          }
        }

        for (const item of dto.items) {
          const variant = variantsById.get(item.variantId)!;
          const available = await this.getAvailableStock(
            item.variantId,
            dto.unitId,
          );

          if (available > 0) {
            throw new BadRequestException({
              code: "PRE_SALE_STOCK_AVAILABLE",
              message:
                "Este tamanho já está disponível para pronta entrega. Atualize o carrinho antes de finalizar.",
              details: {
                variantId: item.variantId,
                availableStock: available,
              },
            });
          }

          const itemPrice = variant.priceOverride ?? variant.product.basePrice;
          const itemTotal = itemPrice * item.quantity;
          totalAmount += itemTotal;

          itemsWithPrice.push({
            variantId: item.variantId,
            studentName: item.studentName,
            quantity: item.quantity,
            unitPrice: itemPrice,
            subtotal: itemTotal,
            productName: variant.product.name,
            variantSize: variant.size,
          });
        }

        return db.transaction(async (tx: DbTransaction) => {
          const [createdOrder] = await tx
            .insert(shopOrders)
            .values({
              orderNumber,
              schoolId: dto.schoolId,
              unitId: dto.unitId,
              orderSource: "PRE_VENDA",
              status: "AGUARDANDO_PAGAMENTO",
              totalAmount,
              customerName: dto.customerName,
              customerPhone: dto.customerPhone,
              customerEmail: dto.customerEmail || null,
              expiresAt: null,
            })
            .returning();

          const orderItemsValues = itemsWithPrice.map((item) => ({
            orderId: createdOrder.id,
            variantId: item.variantId,
            studentName: item.studentName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }));

          await tx.insert(shopOrderItems).values(orderItemsValues);

          return createdOrder;
        });
      },
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      expiresAt: order.expiresAt ?? null,
    };
  }

  /**
   * POST /shop/checkout/init
   *
   * Cria pedido online, reserva estoque por 30 minutos e gera Checkout Session.
   */
  async createCheckout(dto: CreateOrderDto) {
    const db = getDb();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const { order, itemsWithPrice } = await this.createPendingOnlineOrder(
      dto,
      expiresAt,
    );
    let checkoutSession:
      | Awaited<ReturnType<PaymentsService["createCheckoutSession"]>>
      | undefined;

    try {
      checkoutSession = await this.paymentsService.createCheckoutSession({
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail,
        expiresAt,
        items: itemsWithPrice.map((item) => ({
          name: `${item.productName} - Tam. ${item.variantSize}`,
          unitAmount: item.unitPrice,
          quantity: item.quantity,
        })),
      });

      await db
        .update(shopOrders)
        .set({
          stripeCheckoutSessionId: checkoutSession.checkoutSessionId,
          stripePaymentIntentId: checkoutSession.paymentIntentId ?? null,
        })
        .where(eq(shopOrders.id, order.id));

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        expiresAt,
        checkoutUrl: checkoutSession.checkoutUrl,
      };
    } catch (error) {
      if (checkoutSession?.checkoutSessionId) {
        try {
          await this.paymentsService.expireCheckoutSession(
            checkoutSession.checkoutSessionId,
          );
        } catch (stripeCleanupError) {
          console.error(
            `Erro ao expirar Checkout Session órfã ${checkoutSession.checkoutSessionId}:`,
            stripeCleanupError,
          );
        }
      }

      try {
        await this.failStripePayment({
          orderId: order.id,
          status: "CANCELADO",
          reason: "Falha ao iniciar checkout Stripe",
        });
      } catch (cleanupError) {
        console.error(
          `Erro ao liberar reserva do checkout ${order.orderNumber}:`,
          cleanupError,
        );
      }

      throw error;
    }
  }

  /**
   * GET /shop/orders/:orderNumber?phone=XXX
   *
   * Consulta pública com validação de telefone
   */
  async getOrderByNumber(orderNumber: string, phone: string) {
    const db = getDb();

    const order = await db.query.shopOrders.findFirst({
      where: eq(shopOrders.orderNumber, orderNumber),
      with: {
        items: {
          with: {
            variant: {
              with: {
                product: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: `Pedido ${orderNumber} não encontrado`,
      });
    }

    // Validar telefone
    if (order.customerPhone !== phone) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: `Pedido ${orderNumber} não encontrado`,
      });
    }

    const pickupInstructions = await this.getPickupInstructions(order.unitId);

    return this.formatOrderResponse(order, { pickupInstructions });
  }

  /**
   * GET /shop/admin/orders/:id
   *
   * Consulta admin (sem validação de telefone)
   */
  async getOrderById(id: string, scope?: ShopTenantScope) {
    const db = getDb();

    const order = await db.query.shopOrders.findFirst({
      where: this.orderWhere(id, scope),
      with: {
        items: {
          with: {
            variant: {
              with: {
                product: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: `Pedido ${id} não encontrado`,
      });
    }

    const pickupInstructions = await this.getPickupInstructions(order.unitId);

    return this.formatOrderResponse(order, { pickupInstructions });
  }

  /**
   * GET /shop/admin/orders
   *
   * Lista pedidos com filtros e paginação
   */
  async listOrders(filters: ListOrdersDto, scope?: ShopTenantScope) {
    const db = getDb();
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Construir condições
    const conditions: Array<ReturnType<typeof eq>> = [];

    if (!isMasterShopScope(scope)) {
      assertShopTenantScope(scope);
      const scopedTenant = scope!;
      conditions.push(eq(shopOrders.schoolId, scopedTenant.schoolId!));
      if (scopedTenant.unitId) {
        conditions.push(eq(shopOrders.unitId, scopedTenant.unitId));
      }
    } else if (filters.schoolId) {
      conditions.push(eq(shopOrders.schoolId, filters.schoolId));
    }

    if (isMasterShopScope(scope) && filters.unitId) {
      conditions.push(eq(shopOrders.unitId, filters.unitId));
    }

    if (filters.status) {
      conditions.push(eq(shopOrders.status, filters.status));
    }

    if (filters.orderSource) {
      conditions.push(eq(shopOrders.orderSource, filters.orderSource));
    }

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          sql`${shopOrders.customerName} ILIKE ${searchPattern}`,
          sql`${shopOrders.customerPhone} ILIKE ${searchPattern}`,
          sql`${shopOrders.orderNumber} ILIKE ${searchPattern}`,
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Buscar pedidos
    const orders = (await db.query.shopOrders.findMany({
      where: whereClause,
      orderBy: [desc(shopOrders.createdAt)],
      limit,
      offset,
      with: {
        items: {
          with: {
            variant: {
              with: {
                product: true,
              },
            },
          },
        },
        payments: true,
      },
    })) as OrderWithItems[];

    // Contar total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(shopOrders)
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);
    const totalPages = Math.ceil(total / limit);

    return {
      orders: orders.map((order: OrderWithItems) =>
        this.formatOrderResponse(order),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * POST /shop/admin/orders/presential
   *
   * Venda presencial (confirma imediatamente, sem reserva)
   * schoolId e unitId são injetados da sessão do usuário (tenant context)
   */
  async createPresentialSale(
    dto: CreatePresentialSaleDto,
    schoolId: string,
    unitId: string,
    userId: string,
  ) {
    const db = getDb();
    await this.assertUnitBelongsToSchool(schoolId, unitId);

    // 1. Validar itens
    const variantsById = new Map<string, Awaited<ReturnType<typeof this.getActiveVariantForOrder>>>();
    for (const item of dto.items) {
      variantsById.set(
        item.variantId,
        await this.getActiveVariantForOrder(item.variantId, schoolId),
      );
    }

    // 2. Gerar orderNumber
    const orderNumber = await this.generateOrderNumber();

    // 3. Calcular total
    let totalAmount = 0;
    const itemsWithPrice: OrderItemWithPrice[] = [];

    for (const item of dto.items) {
      const variant = variantsById.get(item.variantId)!;

      // Preço: usa priceOverride da variante ou basePrice do produto
      const itemPrice = variant.priceOverride ?? variant.product.basePrice;
      const itemTotal = itemPrice * item.quantity;
      totalAmount += itemTotal;

      itemsWithPrice.push({
        variantId: item.variantId,
        studentName: item.studentName,
        quantity: item.quantity,
        unitPrice: itemPrice,
        subtotal: itemTotal,
        productName: variant.product.name,
        variantSize: variant.size,
      });
    }

    // 4. Validar Pagamentos
    const payments = dto.payments || (dto.paymentMethod ? [{ method: dto.paymentMethod, amount: totalAmount }] : []);

    if (payments.length === 0) {
      throw new BadRequestException("Pelo menos um método de pagamento deve ser informado.");
    }

    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);

    if (totalPaid !== totalAmount) {
      throw new BadRequestException(`Valor pago (${totalPaid}) diverge do total do pedido (${totalAmount})`);
    }

    const now = new Date();
    const primaryPaymentMethod = payments.length === 1 ? payments[0].method : "MULTIPLO";
    const lockTargets = dto.items.map((item) => ({
      variantId: item.variantId,
      unitId,
    }));

    const order = await this.inventoryService.withInventoryLocks(
      lockTargets,
      async () =>
        db.transaction(async (tx: DbTransaction) => {
          for (const item of dto.items) {
            await this.inventoryService.confirmPresentialSaleInTransaction(
              item.variantId,
              unitId,
              item.quantity,
              orderNumber,
              userId,
              tx,
            );
          }

          const [createdOrder] = await tx
            .insert(shopOrders)
            .values({
              orderNumber,
              schoolId,
              unitId,
              orderSource: "PRESENCIAL",
              status: "RETIRADO",
              totalAmount,
              customerName: dto.customerName,
              customerPhone: dto.customerPhone,
              customerEmail: dto.customerEmail || null,
              paymentMethod: primaryPaymentMethod,
              paidAt: now,
              pickedUpAt: now,
              pickedUpBy: userId,
            })
            .returning();

          const orderItemsValues = itemsWithPrice.map((item) => ({
            orderId: createdOrder.id,
            variantId: item.variantId,
            studentName: item.studentName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }));

          await tx.insert(shopOrderItems).values(orderItemsValues);

          if (payments.length > 0) {
            const paymentValues = payments.map(p => ({
              orderId: createdOrder.id,
              paymentMethod: p.method,
              amount: p.amount,
            }));

            await tx.insert(shopOrderPayments).values(paymentValues);
          }

          return createdOrder;
        }),
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      status: order.status,
    };
  }

  /**
   * PATCH /shop/admin/orders/:id/cancel
   *
   * Cancela pedido e libera estoque
   */
  async cancelOrder(
    orderId: string,
    userId: string,
    reason: string,
    scope?: ShopTenantScope,
  ) {
    const db = getDb();

    const cancelledOrder = await this.inventoryService.withOrderLock(
      orderId,
      async () => {
        const order = await db.query.shopOrders.findFirst({
          where: this.orderWhere(orderId, scope),
          with: { items: true },
        });

        if (!order) {
          throw new NotFoundException({
            code: "RESOURCE_NOT_FOUND",
            message: `Pedido ${orderId} não encontrado`,
          });
        }

        if (["CANCELADO", "EXPIRADO", "RETIRADO"].includes(order.status)) {
          throw new BadRequestException({
            code: "INVALID_STATUS",
            message: `Não é possível cancelar pedido com status ${order.status}`,
          });
        }

        const cancelOrderInTransaction = async (tx: DbTransaction) => {
          await tx
            .update(shopOrders)
            .set({
              status: "CANCELADO",
              cancelledAt: new Date(),
              cancelledBy: userId,
              cancellationReason: reason,
            })
            .where(this.orderWhere(orderId, scope));
        };

        if (order.orderSource === "PRE_VENDA") {
          await db.transaction(cancelOrderInTransaction);
          return order;
        }

        const lockTargets = order.items.map((item: ShopOrderItem) => ({
          variantId: item.variantId,
          unitId: order.unitId,
        }));

        await this.inventoryService.withInventoryLocks(lockTargets, async () =>
          db.transaction(async (tx: DbTransaction) => {
            for (const item of order.items) {
              if (order.status === "AGUARDANDO_PAGAMENTO") {
                await this.inventoryService.releaseReservationInTransaction(
                  item.variantId,
                  order.unitId,
                  item.quantity,
                  order.id,
                  tx,
                );
              } else if (order.status === "PAGO") {
                await this.inventoryService.addStockInTransaction(
                  item.variantId,
                  order.unitId,
                  item.quantity,
                  `Estorno do pedido ${order.orderNumber}`,
                  userId,
                  tx,
                  scope,
                );
              }
            }

            await cancelOrderInTransaction(tx);
          }),
        );

        return order;
      },
    );

    if (cancelledOrder.status === "PAGO" && cancelledOrder.stripePaymentIntentId) {
      try {
        await this.paymentsService.refundPayment(
          cancelledOrder.stripePaymentIntentId,
        );
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        // Log erro mas nǜo falhar o cancelamento (estoque jǭ foi liberado)
        console.error(
          `Erro ao criar refund no Stripe para pedido ${cancelledOrder.orderNumber}:`,
          errorMessage,
        );
      }
    }

    return { success: true, message: "Pedido cancelado com sucesso" };
  }

  /**
   * PATCH /shop/admin/orders/:id/pickup
   *
   * Marca pedido como retirado
   */
  async markAsPickedUp(
    orderId: string,
    userId: string,
    scope?: ShopTenantScope,
  ) {
    const db = getDb();

    const order = await db.query.shopOrders.findFirst({
      where: this.orderWhere(orderId, scope),
    });

    if (!order) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: `Pedido ${orderId} não encontrado`,
      });
    }

    if (order.status !== "PAGO") {
      throw new BadRequestException({
        code: "INVALID_STATUS",
        message: `Apenas pedidos pagos podem ser marcados como retirados. Status atual: ${order.status}`,
      });
    }

    await db
      .update(shopOrders)
      .set({
        status: "RETIRADO",
        pickedUpAt: new Date(),
        pickedUpBy: userId,
      })
      .where(this.orderWhere(orderId, scope));

    return { success: true, message: "Pedido marcado como retirado" };
  }

  /**
   * Confirma pagamento online recebido via webhook Stripe.
   *
   * Nao usa escopo de sessao porque o webhook e autenticado por assinatura Stripe.
   */
  async confirmStripePayment(dto: {
    orderId: string;
    paymentIntentId: string;
    paymentMethod: Extract<PaymentMethod, "PIX" | "CARTAO_CREDITO">;
    amount: number;
  }) {
    const db = getDb();

    return this.inventoryService.withOrderLock(dto.orderId, async () => {
      const order = await db.query.shopOrders.findFirst({
        where: eq(shopOrders.id, dto.orderId),
        with: { items: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: "RESOURCE_NOT_FOUND",
          message: `Pedido ${dto.orderId} não encontrado`,
        });
      }

      if (["PAGO", "RETIRADO"].includes(order.status)) {
        return {
          success: true,
          message: "Pagamento Stripe já processado",
          orderNumber: order.orderNumber,
          paymentMethod: order.paymentMethod,
        };
      }

      if (order.status !== "AGUARDANDO_PAGAMENTO") {
        throw new BadRequestException({
          code: "INVALID_STATUS",
          message: `Pedido não pode receber pagamento Stripe no status ${order.status}`,
        });
      }

      if (dto.amount !== order.totalAmount) {
        throw new BadRequestException(
          `Valor pago (${dto.amount}) diverge do total do pedido (${order.totalAmount})`,
        );
      }

      const lockTargets = order.items.map((item: ShopOrderItem) => ({
        variantId: item.variantId,
        unitId: order.unitId,
      }));

      return this.inventoryService.withInventoryLocks(lockTargets, async () =>
        db.transaction(async (tx: DbTransaction) => {
          const currentOrder = await tx.query.shopOrders.findFirst({
            where: eq(shopOrders.id, dto.orderId),
            with: { items: true },
          });

          if (!currentOrder) {
            throw new NotFoundException({
              code: "RESOURCE_NOT_FOUND",
              message: `Pedido ${dto.orderId} não encontrado`,
            });
          }

          if (["PAGO", "RETIRADO"].includes(currentOrder.status)) {
            return {
              success: true,
              message: "Pagamento Stripe já processado",
              orderNumber: currentOrder.orderNumber,
              paymentMethod: currentOrder.paymentMethod,
            };
          }

          if (currentOrder.status !== "AGUARDANDO_PAGAMENTO") {
            throw new BadRequestException({
              code: "INVALID_STATUS",
              message: `Pedido não pode receber pagamento Stripe no status ${currentOrder.status}`,
            });
          }

          if (dto.amount !== currentOrder.totalAmount) {
            throw new BadRequestException(
              `Valor pago (${dto.amount}) diverge do total do pedido (${currentOrder.totalAmount})`,
            );
          }

          for (const item of currentOrder.items) {
            await this.inventoryService.confirmSaleInTransaction(
              item.variantId,
              currentOrder.unitId,
              item.quantity,
              currentOrder.id,
              tx,
            );
          }

          await tx
            .update(shopOrders)
            .set({
              status: "PAGO",
              paymentMethod: dto.paymentMethod,
              paidAt: new Date(),
              stripePaymentIntentId: dto.paymentIntentId,
            })
            .where(eq(shopOrders.id, dto.orderId));

          await tx.insert(shopOrderPayments).values([
            {
              orderId: currentOrder.id,
              paymentMethod: dto.paymentMethod,
              amount: dto.amount,
            },
          ]);

          return {
            success: true,
            message: "Pagamento Stripe confirmado com sucesso",
            orderNumber: currentOrder.orderNumber,
            paymentMethod: dto.paymentMethod,
          };
        }),
      );
    });
  }

  /**
   * Libera reserva de pedido online quando o Stripe informa falha ou expiracao.
   */
  async failStripePayment(dto: {
    orderId: string;
    status: Extract<OrderWithItems["status"], "CANCELADO" | "EXPIRADO">;
    reason: string;
    paymentIntentId?: string;
  }) {
    const db = getDb();

    return this.inventoryService.withOrderLock(dto.orderId, async () => {
      const order = await db.query.shopOrders.findFirst({
        where: eq(shopOrders.id, dto.orderId),
        with: { items: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: "RESOURCE_NOT_FOUND",
          message: `Pedido ${dto.orderId} não encontrado`,
        });
      }

      if (["CANCELADO", "EXPIRADO", "PAGO", "RETIRADO"].includes(order.status)) {
        return {
          success: true,
          message: "Falha Stripe já processada ou pedido finalizado",
          orderNumber: order.orderNumber,
        };
      }

      if (order.status !== "AGUARDANDO_PAGAMENTO") {
        throw new BadRequestException({
          code: "INVALID_STATUS",
          message: `Pedido não pode ser cancelado pelo Stripe no status ${order.status}`,
        });
      }

      const lockTargets = order.items.map((item: ShopOrderItem) => ({
        variantId: item.variantId,
        unitId: order.unitId,
      }));

      return this.inventoryService.withInventoryLocks(lockTargets, async () =>
        db.transaction(async (tx: DbTransaction) => {
          const currentOrder = await tx.query.shopOrders.findFirst({
            where: eq(shopOrders.id, dto.orderId),
            with: { items: true },
          });

          if (!currentOrder) {
            throw new NotFoundException({
              code: "RESOURCE_NOT_FOUND",
              message: `Pedido ${dto.orderId} não encontrado`,
            });
          }

          if (
            ["CANCELADO", "EXPIRADO", "PAGO", "RETIRADO"].includes(
              currentOrder.status,
            )
          ) {
            return {
              success: true,
              message: "Falha Stripe já processada ou pedido finalizado",
              orderNumber: currentOrder.orderNumber,
            };
          }

          if (currentOrder.status !== "AGUARDANDO_PAGAMENTO") {
            throw new BadRequestException({
              code: "INVALID_STATUS",
              message: `Pedido não pode ser cancelado pelo Stripe no status ${currentOrder.status}`,
            });
          }

          for (const item of currentOrder.items) {
            await this.inventoryService.releaseReservationInTransaction(
              item.variantId,
              currentOrder.unitId,
              item.quantity,
              currentOrder.id,
              tx,
            );
          }

          await tx
            .update(shopOrders)
            .set({
              status: dto.status,
              cancelledAt: new Date(),
              cancellationReason: dto.reason,
              stripePaymentIntentId: dto.paymentIntentId,
            })
            .where(eq(shopOrders.id, dto.orderId));

          return {
            success: true,
            message: "Reserva Stripe liberada com sucesso",
            orderNumber: currentOrder.orderNumber,
          };
        }),
      );
    });
  }

  /**
   * PATCH /shop/admin/orders/:id/confirm-payment
   *
   * Confirma pagamento presencial de pedido online (sistema de voucher)
   * Converte reservas de estoque em vendas confirmadas
   */
  async confirmPayment(
    orderId: string,
    // paymentMethod: "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO", // REMOVED
    dto: {
      paymentMethod?: "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "BRINDE",
      payments?: Array<{ method: "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "BRINDE"; amount: number }>
    },
    _adminUserId: string,
    scope?: ShopTenantScope,
  ) {
    const db = getDb();

    return this.inventoryService.withOrderLock(orderId, async () => {
      const order = await db.query.shopOrders.findFirst({
        where: this.orderWhere(orderId, scope),
        with: { items: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: "RESOURCE_NOT_FOUND",
          message: `Pedido ${orderId} não encontrado`,
        });
      }

      if (order.status !== "AGUARDANDO_PAGAMENTO") {
        throw new BadRequestException({
          code: "INVALID_STATUS",
          message: `Apenas pedidos aguardando pagamento podem ter pagamento confirmado. Status atual: ${order.status}`,
        });
      }

      if (
        order.orderSource !== "PRE_VENDA" &&
        order.expiresAt &&
        new Date() > order.expiresAt
      ) {
        throw new BadRequestException({
          code: "ORDER_EXPIRED",
          message: `Pedido expirado em ${order.expiresAt.toLocaleString("pt-BR")}. Por favor, crie um novo pedido.`,
        });
      }

      const payments = dto.payments || (dto.paymentMethod ? [{ method: dto.paymentMethod, amount: order.totalAmount }] : []);

      if (payments.length === 0) {
        throw new BadRequestException("Pelo menos um método de pagamento deve ser informado.");
      }

      const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);

      if (totalPaid !== order.totalAmount) {
        throw new BadRequestException(`Valor pago (${totalPaid}) diverge do total do pedido (${order.totalAmount})`);
      }

      const confirmPaymentInTransaction = async (tx: DbTransaction) => {
        const currentOrder = await tx.query.shopOrders.findFirst({
          where: this.orderWhere(orderId, scope),
          with: { items: true },
        });

        if (!currentOrder) {
          throw new NotFoundException({
            code: "RESOURCE_NOT_FOUND",
            message: `Pedido ${orderId} não encontrado`,
          });
        }

        if (currentOrder.status !== "AGUARDANDO_PAGAMENTO") {
          throw new BadRequestException({
            code: "INVALID_STATUS",
            message: `Apenas pedidos aguardando pagamento podem ter pagamento confirmado. Status atual: ${currentOrder.status}`,
          });
        }

        if (
          currentOrder.orderSource !== "PRE_VENDA" &&
          currentOrder.expiresAt &&
          new Date() > currentOrder.expiresAt
        ) {
          throw new BadRequestException({
            code: "ORDER_EXPIRED",
            message: `Pedido expirado em ${currentOrder.expiresAt.toLocaleString("pt-BR")}. Por favor, crie um novo pedido.`,
          });
        }

        const currentTotalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
        if (currentTotalPaid !== currentOrder.totalAmount) {
          throw new BadRequestException(`Valor pago (${currentTotalPaid}) diverge do total do pedido (${currentOrder.totalAmount})`);
        }

        if (currentOrder.orderSource !== "PRE_VENDA") {
          for (const item of currentOrder.items) {
            await this.inventoryService.confirmSaleInTransaction(
              item.variantId,
              currentOrder.unitId,
              item.quantity,
              currentOrder.id,
              tx,
            );
          }
        }

        const primaryPaymentMethod = payments.length === 1 ? payments[0].method : "MULTIPLO";

        await tx
          .update(shopOrders)
          .set({
            status: "PAGO",
            paymentMethod: primaryPaymentMethod,
            paidAt: new Date(),
          })
          .where(this.orderWhere(orderId, scope));

        if (payments.length > 0) {
          const paymentValues = payments.map(p => ({
            orderId: currentOrder.id,
            paymentMethod: p.method,
            amount: p.amount,
          }));

          await tx.insert(shopOrderPayments).values(paymentValues);
        }

        return {
          success: true,
          message: "Pagamento confirmado com sucesso",
          orderNumber: currentOrder.orderNumber,
          paymentMethod: primaryPaymentMethod,
        };
      };

      if (order.orderSource === "PRE_VENDA") {
        return db.transaction(confirmPaymentInTransaction);
      }

      const lockTargets = order.items.map((item: ShopOrderItem) => ({
        variantId: item.variantId,
        unitId: order.unitId,
      }));

      return this.inventoryService.withInventoryLocks(lockTargets, async () =>
        db.transaction(confirmPaymentInTransaction),
      );
    });
  }

  /**
   * DELETE /shop/admin/orders/:id
   *
   * Exclui permanentemente um pedido (hard delete)
   * Pedidos RETIRADO e PAGO devolvem produtos ao estoque
   */
  async deleteOrder(orderId: string, _userId: string, scope?: ShopTenantScope) {
    const db = getDb();

    await this.inventoryService.withOrderLock(orderId, async () => {
      const order = await db.query.shopOrders.findFirst({
        where: this.orderWhere(orderId, scope),
        with: { items: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: "RESOURCE_NOT_FOUND",
          message: `Pedido ${orderId} não encontrado`,
        });
      }

      if (["PAGO", "RETIRADO"].includes(order.status)) {
        throw new BadRequestException({
          code: "INVALID_STATUS",
          message:
            "Pedidos pagos ou retirados não podem ser excluídos definitivamente",
        });
      }

      if (order.orderSource === "PRE_VENDA") {
        await db.transaction(async (tx: DbTransaction) => {
          await tx.delete(shopOrders).where(this.orderWhere(orderId, scope));
        });
        return;
      }

      const lockTargets = order.items.map((item: ShopOrderItem) => ({
        variantId: item.variantId,
        unitId: order.unitId,
      }));

      await this.inventoryService.withInventoryLocks(lockTargets, async () =>
        db.transaction(async (tx: DbTransaction) => {
          if (order.status === "AGUARDANDO_PAGAMENTO") {
            for (const item of order.items) {
              await this.inventoryService.releaseReservationInTransaction(
                item.variantId,
                order.unitId,
                item.quantity,
                order.id,
                tx,
              );
            }
          }

          await tx.delete(shopOrders).where(this.orderWhere(orderId, scope));
        }),
      );
    });

    return { success: true, message: "Pedido excluído com sucesso" };
  }

  /**
   * Formata resposta de pedido
   */
  private formatOrderResponse(
    order: OrderWithItems,
    options: { pickupInstructions?: string | null } = {},
  ) {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      schoolId: order.schoolId,
      unitId: order.unitId,
      orderSource: order.orderSource,
      status: order.status,
      totalAmount: order.totalAmount,
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        email: order.customerEmail,
      },
      items: order.items.map((item: OrderItemWithVariant) => ({
        id: item.id,
        variantId: item.variantId,
        studentName: item.studentName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.unitPrice * item.quantity,
        product: {
          id: item.variant.product.id,
          name: item.variant.product.name,
          category: item.variant.product.category,
          imageUrl: item.variant.product.imageUrl,
        },
        variant: {
          size: item.variant.size,
          sku: item.variant.sku,
        },
      })),
      paymentMethod: order.paymentMethod,
      payments:
        order.payments?.map((payment: ShopOrderPayment) => ({
          id: payment.id,
          paymentMethod: payment.paymentMethod,
          amount: payment.amount,
          createdAt: payment.createdAt,
        })) ?? [],
      pickupInstructions: options.pickupInstructions ?? null,
      paidAt: order.paidAt,
      expiresAt: order.expiresAt,
      pickedUpAt: order.pickedUpAt,
      pickedUpBy: order.pickedUpBy,
      cancelledAt: order.cancelledAt,
      cancelledBy: order.cancelledBy,
      cancellationReason: order.cancellationReason,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
