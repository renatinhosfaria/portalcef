import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { TenantGuard } from "../../common/guards/tenant.guard";
import {
  CreateProductDto,
  UpdateProductDto,
  InventoryEntryDto,
  InventoryAdjustDto,
  CreatePresentialSaleDto,
  CancelOrderDto,
  ConfirmPaymentDto,
  InterestFiltersDto,
  ListOrdersDto,
  UpdateSettingsDto,
} from "./dto";
import { ShopProductsService } from "./shop-products.service";
import { ShopInventoryService } from "./shop-inventory.service";
import { ShopOrdersService } from "./shop-orders.service";
import { ShopInterestService } from "./shop-interest.service";
import { ShopSettingsService } from "./shop-settings.service";
import {
  getDb,
  shopProducts,
  shopInventory,
  shopOrders,
  shopProductImages,
  shopInterestRequests,
  eq,
  asc,
  and,
  sql,
} from "@essencia/db";

interface UserContext {
  userId: string;
  role: string;
  schoolId: string;
  unitId: string | null;
}

/**
 * ShopAdminController
 *
 * Endpoints administrativos da loja (requer autenticação + roles)
 *
 * Cadeia de Guards:
 * AuthGuard → RolesGuard → TenantGuard
 *
 * Roles com acesso:
 * - master: acesso global
 * - diretora_geral: todas as unidades da escola
 * - gerente_unidade: apenas sua unidade
 * - gerente_financeiro: apenas sua unidade
 */
@Controller("shop/admin")
@UseGuards(AuthGuard, RolesGuard, TenantGuard)
export class ShopAdminController {
  constructor(
    private readonly productsService: ShopProductsService,
    private readonly inventoryService: ShopInventoryService,
    private readonly ordersService: ShopOrdersService,
    private readonly interestService: ShopInterestService,
    private readonly settingsService: ShopSettingsService,
  ) { }

  // ==================== DASHBOARD ====================

  /**
   * GET /shop/admin/dashboard
   *
   * Retorna estatísticas do dashboard administrativo
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Get("dashboard")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async getDashboard(@Req() req: { user: UserContext }) {
    const db = getDb();
    const { schoolId, unitId } = req.user;

    // Construir condições baseadas no tenant
    const orderConditions = unitId
      ? and(
        eq(shopOrders.schoolId, schoolId),
        eq(shopOrders.unitId, unitId),
        eq(shopOrders.status, "CONFIRMADO"),
      )
      : and(
        eq(shopOrders.schoolId, schoolId),
        eq(shopOrders.status, "CONFIRMADO"),
      );

    const inventoryConditions = unitId
      ? and(
        eq(shopInventory.unitId, unitId),
        sql`(${shopInventory.quantity} - ${shopInventory.reservedQuantity}) <= ${shopInventory.lowStockThreshold}`,
      )
      : sql`(${shopInventory.quantity} - ${shopInventory.reservedQuantity}) <= ${shopInventory.lowStockThreshold}`;

    const interestConditions = unitId
      ? and(
        eq(shopInterestRequests.unitId, unitId),
        eq(shopInterestRequests.status, "PENDENTE"),
      )
      : eq(shopInterestRequests.status, "PENDENTE");

    // Contadores de pedidos pendentes de retirada
    const [pendingPickupResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(shopOrders)
      .where(orderConditions);

    // Contadores de produtos com estoque baixo
    const [lowStockResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(shopInventory)
      .where(inventoryConditions);

    // Contadores de interesse não contatado
    const [pendingInterestResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(shopInterestRequests)
      .where(interestConditions);

    return {
      success: true,
      data: {
        pendingPickups: pendingPickupResult?.count || 0,
        lowStockAlerts: lowStockResult?.count || 0,
        pendingInterest: pendingInterestResult?.count || 0,
      },
    };
  }

  // ==================== PRODUTOS ====================

  /**
   * GET /shop/admin/products
   *
   * Lista todos os produtos administrativos
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Get("products")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async getAllProducts(@Req() req: { user: UserContext }) {
    const db = getDb();

    const products = await db.query.shopProducts.findMany({
      where: eq(shopProducts.schoolId, req.user.schoolId),
      with: {
        variants: true,
        images: {
          orderBy: [asc(shopProductImages.displayOrder)],
        },
      },
      orderBy: [asc(shopProducts.name)],
    });

    // Transform to expected format (flatten images array)
    const formattedProducts = products.map((p: any) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...p,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      images: p.images.map((img: any) => img.imageUrl),
    }));

    return {
      success: true,
      data: formattedProducts,
    };
  }

  /**
   * GET /shop/admin/products/:id
   *
   * Detalhes de um produto com variantes e inventário
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Get("products/:id")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async getProductById(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const product = await this.productsService.getProductById(id);

    return {
      success: true,
      data: product,
    };
  }

  /**
   * POST /shop/admin/products
   *
   * Cria novo produto
   * Roles: master, diretora_geral, gerente_unidade
   */
  @Post("products")
  @Roles("master", "diretora_geral", "gerente_unidade")
  @HttpCode(HttpStatus.CREATED)
  async createProduct(
    @Req() req: { user: UserContext },
    @Body() dto: CreateProductDto,
  ) {
    const product = await this.productsService.createProduct(
      dto,
      req.user.userId,
    );

    return {
      success: true,
      data: product,
    };
  }

  /**
   * PATCH /shop/admin/products/:id
   *
   * Atualiza produto existente
   * Roles: master, diretora_geral, gerente_unidade
   */
  @Patch("products/:id")
  @Roles("master", "diretora_geral", "gerente_unidade")
  async updateProduct(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
  ) {
    const product = await this.productsService.updateProduct(
      id,
      dto,
      req.user.userId,
    );

    return {
      success: true,
      data: product,
    };
  }

  /**
   * DELETE /shop/admin/products/:id
   *
   * Remove produto (soft delete - marca isActive=false)
   * Roles: master, diretora_geral
   */
  @Delete("products/:id")
  @Roles("master", "diretora_geral", "gerente_unidade")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProduct(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    await this.productsService.deleteProduct(id, req.user.userId);
  }

  // ==================== VARIANTES ====================

  /**
   * POST /shop/admin/variants
   *
   * Cria nova variante de produto
   * Roles: master, diretora_geral, gerente_unidade
   */
  @Post("variants")
  @Roles("master", "diretora_geral", "gerente_unidade")
  @HttpCode(HttpStatus.CREATED)
  async createVariant(
    @Req() req: { user: UserContext },
    @Body() dto: { productId: string; size: string; sku?: string; priceOverride?: number },
  ) {
    const variant = await this.productsService.createVariant(
      dto,
      req.user.userId,
      req.user.unitId || undefined,
    );

    return {
      success: true,
      data: variant,
    };
  }

  /**
   * PATCH /shop/admin/variants/:id
   *
   * Atualiza variante existente
   * Roles: master, diretora_geral, gerente_unidade
   */
  @Patch("variants/:id")
  @Roles("master", "diretora_geral", "gerente_unidade")
  async updateVariant(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
    @Body() dto: { size?: string; sku?: string; priceOverride?: number; isActive?: boolean },
  ) {
    const variant = await this.productsService.updateVariant(id, dto, req.user.userId);

    return {
      success: true,
      data: variant,
    };
  }

  /**
   * DELETE /shop/admin/variants/:id
   *
   * Remove variante permanentemente
   * Roles: master, diretora_geral, gerente_unidade
   */
  @Delete("variants/:id")
  @Roles("master", "diretora_geral", "gerente_unidade")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteVariant(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    await this.productsService.deleteVariant(id, req.user.userId);
  }

  // ==================== ESTOQUE ====================

  /**
   * GET /shop/admin/inventory
   *
   * Lista todo o inventário com status de estoque
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Get("inventory")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async getAllInventory(@Req() req: { user: UserContext }) {
    const db = getDb();

    // Filtrar por unidade se não for master ou diretora_geral
    const whereClause =
      req.user.role === "master"
        ? undefined
        : req.user.role === "diretora_geral"
          ? eq(shopInventory.unitId, req.user.schoolId)
          : eq(shopInventory.unitId, req.user.unitId!);

    const inventory = await db.query.shopInventory.findMany({
      where: whereClause,
      with: {
        variant: {
          with: {
            product: true,
          },
        },
        unit: true,
      },
      orderBy: [asc(shopInventory.quantity)],
    });

    // Definir tipo para item com relações
    type InventoryWithRelations = (typeof inventory)[number];

    // Transformar para formato mais legível
    const formattedInventory = inventory.map((item: InventoryWithRelations) => {
      // Acessar relações com type assertion seguro
      const unitRelation = item as unknown as { unit?: { name?: string } };
      const variantRelation = item as unknown as {
        variant?: { size?: string; product?: { name?: string } };
      };

      return {
        id: item.id,
        variantId: item.variantId,
        unitId: item.unitId,
        unitName: unitRelation.unit?.name || "N/A",
        productName: variantRelation.variant?.product?.name || "N/A",
        variantSize: variantRelation.variant?.size || "N/A",
        quantity: item.quantity,
        reservedQuantity: item.reservedQuantity,
        available: Math.max(0, item.quantity - item.reservedQuantity),
        lowStockThreshold: item.lowStockThreshold,
        needsRestock:
          item.quantity - item.reservedQuantity <= item.lowStockThreshold,
      };
    });

    return {
      success: true,
      data: formattedInventory,
    };
  }

  /**
   * GET /shop/admin/inventory/:variantId/:unitId
   *
   * Retorna status de estoque de uma variante em uma unidade
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Get("inventory/:variantId/:unitId")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async getInventory(
    @Param("variantId") variantId: string,
    @Param("unitId") unitId: string,
  ) {
    const inventory = await this.inventoryService.getInventory(
      variantId,
      unitId,
    );

    return {
      success: true,
      data: inventory,
    };
  }

  /**
   * POST /shop/admin/inventory/entry
   *
   * Adiciona estoque (ENTRADA)
   * Roles: master, diretora_geral, gerente_unidade
   */
  @Post("inventory/entry")
  @Roles("master", "diretora_geral", "gerente_unidade")
  @HttpCode(HttpStatus.CREATED)
  async addInventory(
    @Req() req: { user: UserContext },
    @Body() dto: InventoryEntryDto,
  ) {
    const result = await this.inventoryService.addStock(
      dto.variantId,
      dto.unitId,
      dto.quantity,
      dto.notes || "Entrada de estoque",
      req.user.userId,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * POST /shop/admin/inventory/adjust
   *
   * Ajusta estoque (positivo ou negativo)
   * Roles: master, diretora_geral, gerente_unidade
   */
  @Post("inventory/adjust")
  @Roles("master", "diretora_geral", "gerente_unidade")
  @HttpCode(HttpStatus.CREATED)
  async adjustInventory(
    @Req() req: { user: UserContext },
    @Body() dto: InventoryAdjustDto,
  ) {
    const result = await this.inventoryService.adjustStock(
      dto.variantId,
      dto.unitId,
      dto.quantityChange,
      dto.notes,
      req.user.userId,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /shop/admin/inventory/ledger/:variantId/:unitId
   *
   * Retorna histórico de movimentações de estoque
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Get("inventory/ledger/:variantId/:unitId")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async getInventoryLedger(
    @Param("variantId") variantId: string,
    @Param("unitId") unitId: string,
  ) {
    const ledger = await this.inventoryService.getInventoryLedger(
      variantId,
      unitId,
    );

    return {
      success: true,
      data: ledger,
    };
  }

  // ==================== PEDIDOS ====================

  /**
   * GET /shop/admin/orders
   *
   * Lista pedidos com filtros e busca
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Get("orders")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async listOrders(
    @Req() req: { user: UserContext },
    @Query() query: ListOrdersDto,
  ) {
    const filters: ListOrdersDto = {
      schoolId: req.user.schoolId,
      unitId: req.user.unitId || undefined,
      page: query.page || 1,
      limit: query.limit || 20,
      status: query.status,
      orderSource: query.orderSource,
      search: query.search,
    };

    const result = await this.ordersService.listOrders(filters);

    return {
      success: true,
      data: result.orders,
      meta: {
        pagination: result.pagination,
      },
    };
  }

  /**
   * GET /shop/admin/orders/:id
   *
   * Detalhes de um pedido específico
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Get("orders/:id")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async getOrderById(@Param("id") id: string) {
    const order = await this.ordersService.getOrderById(id);

    return {
      success: true,
      data: order,
    };
  }

  /**
   * POST /shop/admin/orders/presencial
   *
   * Cria venda presencial (baixa estoque DIRETO, sem reserva)
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Post("orders/presencial")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  @HttpCode(HttpStatus.CREATED)
  async createPresentialSale(
    @Req() req: { user: UserContext },
    @Body() dto: CreatePresentialSaleDto,
  ) {
    const order = await this.ordersService.createPresentialSale(
      dto,
      req.user.userId,
    );

    return {
      success: true,
      data: order,
    };
  }

  /**
   * PATCH /shop/admin/orders/:id/cancel
   *
   * Cancela pedido (libera estoque + refund Stripe se PAGO)
   * Roles: master, diretora_geral, gerente_unidade
   */
  @Patch("orders/:id/cancel")
  @Roles("master", "diretora_geral", "gerente_unidade")
  async cancelOrder(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
    @Body() dto: CancelOrderDto,
  ) {
    await this.ordersService.cancelOrder(id, req.user.userId, dto.reason);

    return {
      success: true,
      data: { message: "Pedido cancelado com sucesso" },
    };
  }

  /**
   * PATCH /shop/admin/orders/:id/confirm-payment
   *
   * Confirma pagamento presencial de pedido online (sistema de voucher)
   * Converte reservas de estoque em vendas confirmadas
   *
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Patch("orders/:id/confirm-payment")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async confirmPayment(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
    @Body() dto: ConfirmPaymentDto,
  ) {
    const result = await this.ordersService.confirmPayment(
      id,
      dto.paymentMethod,
      req.user.userId,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * PATCH /shop/admin/orders/:id/pickup
   *
   * Marca pedido como RETIRADO
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Patch("orders/:id/pickup")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async markAsPickedUp(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const order = await this.ordersService.markAsPickedUp(id, req.user.userId);

    return {
      success: true,
      data: order,
    };
  }

  // ==================== LISTA DE INTERESSE ====================

  /**
   * GET /shop/admin/interest
   *
   * Lista requisições de interesse com filtros
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   *
   * Query params: status, search, page, limit
   */
  @Get("interest")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async listInterestRequests(
    @Req() req: { user: UserContext },
    @Query() filters: InterestFiltersDto,
  ) {
    const unitId = req.user.unitId!;
    const result = await this.interestService.getInterestRequests(
      unitId,
      filters,
    );

    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  /**
   * GET /shop/admin/interest/summary
   *
   * Retorna resumo analítico de interesse
   * - Top 10 produtos mais solicitados (últimos 30 dias)
   * - Contadores por status
   *
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Get("interest/summary")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async getInterestSummary(@Req() req: { user: UserContext }) {
    const unitId = req.user.unitId!;
    const result = await this.interestService.getInterestSummary(unitId);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * PATCH /shop/admin/interest/:id/contacted
   *
   * Marca requisição como CONTATADO
   * Atualiza status, contactedAt e contactedBy
   *
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Patch("interest/:id/contacted")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async markAsContacted(
    @Req() req: { user: UserContext },
    @Param("id") id: string,
  ) {
    const result = await this.interestService.markAsContacted(
      id,
      req.user.userId,
    );

    return {
      success: true,
      data: result,
    };
  }

  // ==================== CONFIGURAÇÕES ====================

  /**
   * GET /shop/admin/settings/:unitId
   *
   * Retorna configurações da loja para uma unidade
   * Roles: master, diretora_geral, gerente_unidade, gerente_financeiro
   */
  @Get("settings/:unitId")
  @Roles("master", "diretora_geral", "gerente_unidade", "gerente_financeiro")
  async getSettings(@Param("unitId") unitId: string) {
    const settings = await this.settingsService.getSettings(unitId);

    return {
      success: true,
      data: settings,
    };
  }

  /**
   * PATCH /shop/admin/settings/:unitId
   *
   * Atualiza configurações da loja
   * Roles: master, diretora_geral, gerente_unidade
   */
  @Patch("settings/:unitId")
  @Roles("master", "diretora_geral", "gerente_unidade")
  async updateSettings(
    @Req() req: { user: UserContext },
    @Param("unitId") unitId: string,
    @Body() dto: UpdateSettingsDto,
  ) {
    const settings = await this.settingsService.updateSettings(
      unitId,
      dto,
      req.user.userId,
    );

    return {
      success: true,
      data: settings,
    };
  }
}
