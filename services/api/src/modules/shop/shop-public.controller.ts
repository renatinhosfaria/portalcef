import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  CreateOrderDto,
  GetOrderDto,
  CatalogFiltersDto,
  CreateInterestRequestDto,
} from "./dto";
import { ShopProductsService } from "./shop-products.service";
import { ShopOrdersService } from "./shop-orders.service";
import { ShopInterestService } from "./shop-interest.service";
import { ShopLocationsService } from "./shop-locations.service";

/**
 * ShopPublicController
 *
 * Endpoints públicos da loja (sem autenticação)
 * - Catálogo de produtos
 * - Criar pedido
 * - Consultar pedido
 *
 * IMPORTANTE: Não usa @UseGuards(AuthGuard) - acesso público
 * Rate limit aplicado via @nestjs/throttler em endpoints sensíveis
 */
@Controller("shop")
export class ShopPublicController {
  constructor(
    private readonly productsService: ShopProductsService,
    private readonly ordersService: ShopOrdersService,
    private readonly interestService: ShopInterestService,
    private readonly locationsService: ShopLocationsService,
  ) {}

  /**
   * GET /shop/catalog/:schoolId/:unitId
   *
   * Retorna catálogo de produtos com estoque disponível para uma unidade
   * Público - sem autenticação
   *
   * Query params:
   * - category?: UNIFORME_DIARIO | UNIFORME_EDUCACAO_FISICA | ACESSORIO
   * - size?: "2" | "4" | "6" | etc
   * - inStock?: boolean (filtrar apenas com estoque)
   */
  @Get("catalog/:schoolId/:unitId")
  async getCatalog(
    @Param("schoolId", new ParseUUIDPipe({ version: "4" })) schoolId: string,
    @Param("unitId", new ParseUUIDPipe({ version: "4" })) unitId: string,
    @Query() filters: CatalogFiltersDto,
  ) {
    const products = await this.productsService.getProducts(
      schoolId,
      unitId,
      filters,
    );

    return {
      success: true,
      data: products,
      meta: {
        schoolId,
        unitId,
        filters,
      },
    };
  }

  /**
   * GET /shop/locations
   *
   * Retorna lista de escolas e unidades disponiveis para a loja.
   * Publico - sem autenticacao
   */
  @Get("locations")
  async getLocations() {
    const locations = await this.locationsService.listLocations();

    return {
      success: true,
      data: locations,
    };
  }

  /**
   * GET /shop/products/:id
   *
   * Retorna detalhe de um produto com todas as variantes
   * Público - sem autenticação
   */
  @Get("products/:id")
  async getProductById(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Query("schoolId", new ParseUUIDPipe({ version: "4" })) schoolId: string,
    @Query("unitId", new ParseUUIDPipe({ version: "4" })) unitId: string,
  ) {
    const product = await this.productsService.getPublicProductById(
      id,
      schoolId,
      unitId,
    );

    return {
      success: true,
      data: product,
    };
  }

  /**
   * POST /shop/orders
   *
   * Cria um novo pedido para voucher presencial.
   * Público - sem autenticação
   *
   * Rate limit: 50 pedidos por hora por IP (@nestjs/throttler)
   *
   * Fluxo:
   * 1. Valida estoque disponível para todos os itens
   * 2. Reserva estoque (Redis lock atômico)
   * 3. Cria pedido com status AGUARDANDO_PAGAMENTO
   * 4. Define expiração em 7 dias
   * 5. Retorna dados do pedido para acompanhamento e voucher
   */
  @Post("orders")
  @Throttle({ strict: { limit: 50, ttl: 3600000 } }) // 50 pedidos por hora
  @HttpCode(HttpStatus.CREATED)
  async createOrder(@Body() dto: CreateOrderDto) {
    const result = await this.ordersService.createOrder(dto);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * POST /shop/orders/pre-venda
   *
   * Cria um voucher de pré-venda sem reservar estoque.
   * Usado quando o tamanho escolhido ainda não chegou na escola.
   */
  @Post("orders/pre-venda")
  @Throttle({ strict: { limit: 50, ttl: 3600000 } }) // 50 pedidos por hora
  @HttpCode(HttpStatus.CREATED)
  async createPreSaleOrder(@Body() dto: CreateOrderDto) {
    const result = await this.ordersService.createPreSaleOrder(dto);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * GET /shop/orders/:orderNumber
   *
   * Consulta pedido existente
   * Público - validação por telefone
   *
   * Query param obrigatório: phone (apenas números)
   * Valida que orderNumber pertence ao telefone informado
   */
  @Get("orders/:orderNumber")
  @Throttle({ strict: { limit: 60, ttl: 3600000 } }) // 60 consultas por hora
  async getOrderByNumber(
    @Param("orderNumber") orderNumber: string,
    @Query() query: GetOrderDto,
  ) {
    const order = await this.ordersService.getOrderByNumber(
      orderNumber,
      query.phone,
    );

    return {
      success: true,
      data: order,
    };
  }

  /**
   * POST /shop/interest
   *
   * Registra interesse em produtos sem estoque
   * Público - sem autenticação
   *
   * Body: customer, student, items[]
   */
  @Post("interest")
  @Throttle({ strict: { limit: 20, ttl: 3600000 } }) // 20 interesses por hora
  @HttpCode(HttpStatus.CREATED)
  async createInterestRequest(@Body() dto: CreateInterestRequestDto) {
    const result = await this.interestService.createInterestRequest(dto);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * POST /shop/checkout/init
   *
   * Cria pedido online e inicializa Checkout hospedado do Stripe.
   * A confirmação de pagamento acontece somente pelo webhook Stripe.
   */
  @Post("checkout/init")
  @Throttle({ strict: { limit: 50, ttl: 3600000 } }) // 50 checkouts por hora
  @HttpCode(HttpStatus.CREATED)
  async initCheckout(@Body() dto: CreateOrderDto) {
    const result = await this.ordersService.createCheckout(dto);

    return {
      success: true,
      data: result,
    };
  }
}
