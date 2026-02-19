import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
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
import { PaymentsService } from "../payments/payments.service";

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
    private readonly paymentsService: PaymentsService,
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
    @Param("schoolId") schoolId: string,
    @Param("unitId") unitId: string,
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
  async getProductById(@Param("id") id: string) {
    const product = await this.productsService.getProductById(id);

    return {
      success: true,
      data: product,
    };
  }

  /**
   * POST /shop/orders
   *
   * Cria um novo pedido (reserva estoque + cria PaymentIntent Stripe)
   * Público - sem autenticação
   *
   * Rate limit: 50 pedidos por hora por IP (@nestjs/throttler)
   *
   * Fluxo:
   * 1. Valida estoque disponível para todos os itens
   * 2. Reserva estoque (Redis lock atômico)
   * 3. Cria pedido com status AGUARDANDO_PAGAMENTO
   * 4. Cria PaymentIntent no Stripe
   * 5. Define expiração (now + 15 min)
   * 6. Retorna { orderId, orderNumber, clientSecret }
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
   * GET /shop/orders/:orderNumber
   *
   * Consulta pedido existente
   * Público - validação por telefone
   *
   * Query param obrigatório: phone (apenas números)
   * Valida que orderNumber pertence ao telefone informado
   */
  @Get("orders/:orderNumber")
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
   * Inicializa PaymentIntent para Stripe Elements
   * Permite renderizar o formulário de pagamento antes de criar o pedido
   */
  @Post("checkout/init")
  @HttpCode(HttpStatus.CREATED)
  async initCheckout(@Body() body: { amount: number }) {
    if (!body.amount || body.amount < 100) {
      throw new BadRequestException("Valor inválido (mínimo 100 centavos)");
    }

    const { clientSecret, paymentIntentId } =
      await this.paymentsService.createPaymentIntent(body.amount, {});

    return {
      success: true,
      data: { clientSecret, paymentIntentId },
    };
  }
}
