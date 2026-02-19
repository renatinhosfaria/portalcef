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

      const itemPrice = variant!.priceOverride ?? variant!.product.basePrice;
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
    // Voucher válido por 7 dias (cliente paga presencialmente na escola)
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

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

    // ============================================================
    // STRIPE DESABILITADO - Sistema de Voucher Ativo
    // Cliente recebe voucher e paga presencialmente na escola
    // Código mantido para futura reintegração com Stripe
    // ============================================================
    /*
    // 7. Processar PaymentIntent (Criar novo ou Atualizar existente)
    let clientSecret: string | undefined;
    let paymentIntentId: string | undefined;

    try {
      if (dto.paymentIntentId) {
        // Cenário A: Intent já existe (Checkout Elements Flow)
        paymentIntentId = dto.paymentIntentId;

        // Atualizar metadata do Intent com dados do pedido real
        await this.paymentsService.updatePaymentIntent(paymentIntentId, {
          orderId: order.id,
          orderNumber: order.orderNumber,
          schoolId: dto.schoolId,
          unitId: dto.unitId,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
        });

        // Recuperar clientSecret (opcional, mas bom retornar)
        const intent = await this.paymentsService
          .getStripeClient()
          .paymentIntents.retrieve(paymentIntentId);
        clientSecret = intent.client_secret || undefined;

        // TODO: Validar se amount do intent bate com totalAmount?
        // Se houver divergência (ex: preço mudou durante checkout), devíamos cancelar/erro.
        if (intent.amount !== totalAmount) {
          throw new BadRequestException(
            "Valor do pagamento diverge do total do pedido",
          );
        }
      } else {
        // Cenário B: Criar novo Intent (Flow antigo / Backend-only)
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
      }

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
    */
    // ============================================================

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      expiresAt: order.expiresAt,
      // clientSecret não retornado - sistema de voucher ativo
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
   * schoolId e unitId são injetados da sessão do usuário (tenant context)
   */
  async createPresentialSale(
    dto: CreatePresentialSaleDto,
    schoolId: string,
    unitId: string,
    userId: string,
  ) {
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

      // Preço: usa priceOverride da variante ou basePrice do produto
      const itemPrice = variant!.priceOverride || variant!.product.basePrice;
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

    // 4. Validar Pagamentos
    const payments = dto.payments || (dto.paymentMethod ? [{ method: dto.paymentMethod, amount: totalAmount }] : []);

    if (payments.length === 0) {
      throw new BadRequestException("Pelo menos um método de pagamento deve ser informado.");
    }

    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);

    // Se houver pagamento como BRINDE, aceitamos qualquer valor (geralmente 0 ou parcial)
    // Caso contrário, o valor pago deve bater com o total
    const hasBrinde = payments.some(p => p.method === "BRINDE");

    if (!hasBrinde && totalPaid !== totalAmount) {
      throw new BadRequestException(`Valor pago (${totalPaid}) diverge do total do pedido (${totalAmount})`);
    }

    // 5. Decrementar estoque DIRETAMENTE (sem reserva)
    const salesConfirmed: Array<{
      variantId: string;
      unitId: string;
      quantity: number;
    }> = [];

    // Decrementa estoque usando função dedicada para venda presencial
    for (const item of dto.items) {
      await this.inventoryService.confirmPresentialSale(
        item.variantId,
        unitId,
        item.quantity,
        orderNumber,
        userId,
      );
      salesConfirmed.push({
        variantId: item.variantId,
        unitId: unitId,
        quantity: item.quantity,
      });
    }

    // 6. Criar pedido com status RETIRADO e pagamentos
    const now = new Date();

    // Determina método de pagamento principal para campo legado/resumo
    const primaryPaymentMethod = payments.length === 1 ? payments[0].method : "MULTIPLO";

    const [order] = await db
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

    // 7. Criar itens
    const orderItemsValues = itemsWithPrice.map((item) => ({
      orderId: order.id,
      variantId: item.variantId,
      studentName: item.studentName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
    }));

    await db.insert(shopOrderItems).values(orderItemsValues);

    // 8. Criar registros de pagamento
    if (payments.length > 0) {
      // Importar tabela se necessário, ou usar string literal se import circular for problema
      // Assumindo shopOrderPayments importado do @essencia/db (precisa adicionar no topo se não tiver)
      const { shopOrderPayments } = await import("@essencia/db");

      const paymentValues = payments.map(p => ({
        orderId: order.id,
        paymentMethod: p.method,
        amount: p.amount,
      }));

      await db.insert(shopOrderPayments).values(paymentValues);
    }

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
  ) {
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

    // Validar status permite confirmação de pagamento
    if (order.status !== "AGUARDANDO_PAGAMENTO") {
      throw new BadRequestException({
        code: "INVALID_STATUS",
        message: `Apenas pedidos aguardando pagamento podem ter pagamento confirmado. Status atual: ${order.status}`,
      });
    }

    // Verificar se pedido não expirou
    if (order.expiresAt && new Date() > order.expiresAt) {
      throw new BadRequestException({
        code: "ORDER_EXPIRED",
        message: `Pedido expirado em ${order.expiresAt.toLocaleString("pt-BR")}. Por favor, crie um novo pedido.`,
      });
    }

    // Validar Pagamentos
    const payments = dto.payments || (dto.paymentMethod ? [{ method: dto.paymentMethod, amount: order.totalAmount }] : []);

    if (payments.length === 0) {
      throw new BadRequestException("Pelo menos um método de pagamento deve ser informado.");
    }

    const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);

    const hasBrinde = payments.some(p => p.method === "BRINDE");

    if (!hasBrinde && totalPaid !== order.totalAmount) {
      throw new BadRequestException(`Valor pago (${totalPaid}) diverge do total do pedido (${order.totalAmount})`);
    }

    // Converter reservas em vendas confirmadas
    for (const item of order.items) {
      await this.inventoryService.confirmSale(
        item.variantId,
        order.unitId,
        item.quantity,
        order.id,
      );
    }

    const primaryPaymentMethod = payments.length === 1 ? payments[0].method : "MULTIPLO";

    // Atualizar pedido para PAGO
    await db
      .update(shopOrders)
      .set({
        status: "PAGO",
        paymentMethod: primaryPaymentMethod,
        paidAt: new Date(),
      })
      .where(eq(shopOrders.id, orderId));

    // Criar registros de pagamento
    if (payments.length > 0) {
      const { shopOrderPayments } = await import("@essencia/db");

      const paymentValues = payments.map(p => ({
        orderId: order.id,
        paymentMethod: p.method,
        amount: p.amount,
      }));

      await db.insert(shopOrderPayments).values(paymentValues);
    }

    return {
      success: true,
      message: "Pagamento confirmado com sucesso",
      orderNumber: order.orderNumber,
      paymentMethod: primaryPaymentMethod,
    };
  }

  /**
   * DELETE /shop/admin/orders/:id
   *
   * Exclui permanentemente um pedido (hard delete)
   * Pedidos RETIRADO e PAGO devolvem produtos ao estoque
   */
  async deleteOrder(orderId: string, userId: string) {
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

    // Se AGUARDANDO_PAGAMENTO, liberar reservas antes de excluir
    if (order.status === "AGUARDANDO_PAGAMENTO") {
      for (const item of order.items) {
        try {
          await this.inventoryService.releaseReservation(
            item.variantId,
            order.unitId,
            item.quantity,
            order.id,
          );
        } catch (error) {
          console.warn(
            `Erro ao liberar reserva do item ${item.id} do pedido ${order.orderNumber}:`,
            error,
          );
        }
      }
    }

    // Se PAGO ou RETIRADO, devolver produtos ao estoque
    if (order.status === "PAGO" || order.status === "RETIRADO") {
      for (const item of order.items) {
        try {
          await this.inventoryService.addStock(
            item.variantId,
            order.unitId,
            item.quantity,
            `Estorno por exclusão do pedido ${order.orderNumber}`,
            userId,
          );
        } catch (error) {
          console.warn(
            `Erro ao devolver estoque do item ${item.id} do pedido ${order.orderNumber}:`,
            error,
          );
        }
      }
    }

    // Deletar pedido (itens são removidos automaticamente via CASCADE)
    await db.delete(shopOrders).where(eq(shopOrders.id, orderId));

    return { success: true, message: "Pedido excluído com sucesso" };
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
          imageUrl: item.variant.product.imageUrl,
        },
        variant: {
          size: item.variant.size,
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
