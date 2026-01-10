import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from "@nestjs/common";
import {
  getDb,
  shopOrders,
  type ShopOrder,
  shopOrderItems,
  type ShopOrderItem,
  shopProductVariants,
  type ShopProductVariant,
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

type OrderItemWithPrice = {
  variantId: string;
  studentName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

type OrderItemVariant = ShopProductVariant & {
  product: ShopProduct;
  color?: string | null;
};

type OrderItemWithVariant = ShopOrderItem & {
  variant: OrderItemVariant;
};

type OrderWithItems = ShopOrder & {
  items: OrderItemWithVariant[];
  updatedAt?: Date | null;
};

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
  ) {}

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

  /**
   * POST /shop/orders
   *
   * Cria pedido online com reserva de estoque
   */
  async createOrder(dto: CreateOrderDto) {
    const db = getDb();

    // 1. Validar itens existem
    for (const item of dto.items) {
      const variant = await db.query.shopProductVariants.findFirst({
        where: eq(shopProductVariants.id, item.variantId),
        with: { product: true },
      });

      if (!variant || !variant.product.isActive) {
        throw new NotFoundException({
          code: "RESOURCE_NOT_FOUND",
          message: `Produto ou variante não encontrado: ${item.variantId}`,
        });
      }
    }

    // 2. Gerar orderNumber
    const orderNumber = await this.generateOrderNumber();

    // 3. Calcular total
    let totalAmount = 0;
    const itemsWithPrice: OrderItemWithPrice[] = [];

    for (const item of dto.items) {
      const variant = await db.query.shopProductVariants.findFirst({
        where: eq(shopProductVariants.id, item.variantId),
        with: { product: true },
      });

      const itemPrice = variant!.product.price;
      const itemTotal = itemPrice * item.quantity;
      totalAmount += itemTotal;

      itemsWithPrice.push({
        variantId: item.variantId,
        studentName: item.studentName,
        quantity: item.quantity,
        unitPrice: itemPrice,
        subtotal: itemTotal,
      });
    }

    // 4. Reservar estoque para cada item (atômico com Redis locks)
    const reservations: Array<{
      variantId: string;
      unitId: string;
      quantity: number;
    }> = [];
    try {
      for (const item of dto.items) {
        await this.inventoryService.reserveStock(
          item.variantId,
          dto.unitId,
          item.quantity,
          orderNumber, // Usa orderNumber como referência temporária
        );
        reservations.push({
          variantId: item.variantId,
          unitId: dto.unitId,
          quantity: item.quantity,
        });
      }
    } catch (error) {
      // Rollback: liberar reservas já feitas
      for (const reservation of reservations) {
        await this.inventoryService.releaseReservation(
          reservation.variantId,
          reservation.unitId,
          reservation.quantity,
          orderNumber,
        );
      }
      throw error;
    }

    // 5. Criar pedido
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    const [order] = await db
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

    // 6. Criar itens do pedido
    const orderItemsValues = itemsWithPrice.map((item) => ({
      orderId: order.id,
      variantId: item.variantId,
      studentName: item.studentName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }));

    await db.insert(shopOrderItems).values(orderItemsValues);

    // 7. Criar PaymentIntent no Stripe
    let clientSecret: string | undefined;
    let paymentIntentId: string | undefined;

    try {
      const paymentIntent = await this.paymentsService.createPaymentIntent(
        totalAmount,
        {
          orderId: order.id,
          orderNumber: order.orderNumber,
          schoolId: dto.schoolId,
          unitId: dto.unitId,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
        },
        dto.installments || 1,
      );

      clientSecret = paymentIntent.clientSecret;
      paymentIntentId = paymentIntent.paymentIntentId;

      // Atualizar pedido com stripePaymentIntentId
      await db
        .update(shopOrders)
        .set({ stripePaymentIntentId: paymentIntentId })
        .where(eq(shopOrders.id, order.id));
    } catch (error) {
      // Se falhar criar PaymentIntent, liberar reservas e deletar pedido
      for (const reservation of reservations) {
        await this.inventoryService.releaseReservation(
          reservation.variantId,
          reservation.unitId,
          reservation.quantity,
          orderNumber,
        );
      }

      // Deletar pedido e itens (cascade)
      await db.delete(shopOrders).where(eq(shopOrders.id, order.id));

      throw error;
    }

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      expiresAt: order.expiresAt,
      clientSecret,
    };
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
      throw new ForbiddenException({
        code: "FORBIDDEN",
        message: "Telefone não corresponde ao pedido",
      });
    }

    return this.formatOrderResponse(order);
  }

  /**
   * GET /shop/admin/orders/:id
   *
   * Consulta admin (sem validação de telefone)
   */
  async getOrderById(id: string) {
    const db = getDb();

    const order = await db.query.shopOrders.findFirst({
      where: eq(shopOrders.id, id),
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
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: `Pedido ${id} não encontrado`,
      });
    }

    return this.formatOrderResponse(order);
  }

  /**
   * GET /shop/admin/orders
   *
   * Lista pedidos com filtros e paginação
   */
  async listOrders(filters: ListOrdersDto) {
    const db = getDb();
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    // Construir condições
    const conditions: Array<ReturnType<typeof eq>> = [];

    if (filters.schoolId) {
      conditions.push(eq(shopOrders.schoolId, filters.schoolId));
    }

    if (filters.unitId) {
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
   */
  async createPresentialSale(dto: CreatePresentialSaleDto, userId: string) {
    const db = getDb();

    // 1. Validar itens
    for (const item of dto.items) {
      const variant = await db.query.shopProductVariants.findFirst({
        where: eq(shopProductVariants.id, item.variantId),
        with: { product: true },
      });

      if (!variant || !variant.product.isActive) {
        throw new NotFoundException({
          code: "RESOURCE_NOT_FOUND",
          message: `Produto ou variante não encontrado: ${item.variantId}`,
        });
      }
    }

    // 2. Gerar orderNumber
    const orderNumber = await this.generateOrderNumber();

    // 3. Calcular total
    let totalAmount = 0;
    const itemsWithPrice: OrderItemWithPrice[] = [];

    for (const item of dto.items) {
      const variant = await db.query.shopProductVariants.findFirst({
        where: eq(shopProductVariants.id, item.variantId),
        with: { product: true },
      });

      const itemPrice = variant!.product.price;
      const itemTotal = itemPrice * item.quantity;
      totalAmount += itemTotal;

      itemsWithPrice.push({
        variantId: item.variantId,
        studentName: item.studentName,
        quantity: item.quantity,
        unitPrice: itemPrice,
        subtotal: itemTotal,
      });
    }

    // 4. Decrementar estoque DIRETAMENTE (sem reserva)
    const salesConfirmed: Array<{
      variantId: string;
      unitId: string;
      quantity: number;
    }> = [];
    for (const item of dto.items) {
      // Usa confirmSale com orderId temporário (será substituído)
      await this.inventoryService.confirmSale(
        item.variantId,
        dto.unitId,
        item.quantity,
        orderNumber,
      );
      salesConfirmed.push({
        variantId: item.variantId,
        unitId: dto.unitId,
        quantity: item.quantity,
      });
    }

    // 5. Criar pedido com status RETIRADO
    const now = new Date();

    const [order] = await db
      .insert(shopOrders)
      .values({
        orderNumber,
        schoolId: dto.schoolId,
        unitId: dto.unitId,
        orderSource: "PRESENCIAL",
        status: "RETIRADO",
        totalAmount,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail || null,
        paymentMethod: dto.paymentMethod,
        paidAt: now,
        pickedUpAt: now,
        pickedUpBy: userId,
      })
      .returning();

    // 6. Criar itens
    const orderItemsValues = itemsWithPrice.map((item) => ({
      orderId: order.id,
      variantId: item.variantId,
      studentName: item.studentName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }));

    await db.insert(shopOrderItems).values(orderItemsValues);

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
  async cancelOrder(orderId: string, userId: string, reason: string) {
    const db = getDb();

    const order = await db.query.shopOrders.findFirst({
      where: eq(shopOrders.id, orderId),
      with: { items: true },
    });

    if (!order) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: `Pedido ${orderId} não encontrado`,
      });
    }

    // Validar status permite cancelamento
    if (["CANCELADO", "EXPIRADO", "RETIRADO"].includes(order.status)) {
      throw new BadRequestException({
        code: "INVALID_STATUS",
        message: `Não é possível cancelar pedido com status ${order.status}`,
      });
    }

    // Liberar estoque
    for (const item of order.items) {
      if (order.status === "AGUARDANDO_PAGAMENTO") {
        // Libera reserva
        await this.inventoryService.releaseReservation(
          item.variantId,
          order.unitId,
          item.quantity,
          order.id,
        );
      } else if (order.status === "PAGO") {
        // Estorna estoque (incrementa quantity de volta)
        await this.inventoryService.addStock(
          item.variantId,
          order.unitId,
          item.quantity,
          `Estorno do pedido ${order.orderNumber}`,
          userId,
        );
      }
    }

    // Atualizar pedido
    await db
      .update(shopOrders)
      .set({
        status: "CANCELADO",
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancellationReason: reason,
      })
      .where(eq(shopOrders.id, orderId));

    // Se pago, criar refund no Stripe
    if (order.status === "PAGO" && order.stripePaymentIntentId) {
      try {
        await this.paymentsService.refundPayment(order.stripePaymentIntentId);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        // Log erro mas nǜo falhar o cancelamento (estoque jǭ foi liberado)
        console.error(
          `Erro ao criar refund no Stripe para pedido ${order.orderNumber}:`,
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
  async markAsPickedUp(orderId: string, userId: string) {
    const db = getDb();

    const order = await db.query.shopOrders.findFirst({
      where: eq(shopOrders.id, orderId),
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
      .where(eq(shopOrders.id, orderId));

    return { success: true, message: "Pedido marcado como retirado" };
  }

  /**
   * Formata resposta de pedido
   */
  private formatOrderResponse(order: OrderWithItems) {
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
        },
        variant: {
          size: item.variant.size,
          color: item.variant.color,
          sku: item.variant.sku,
        },
      })),
      paymentMethod: order.paymentMethod,
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
