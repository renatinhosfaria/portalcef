import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import {
  getDb,
  shopInterestRequests,
  shopInterestItems,
  shopProducts,
  shopProductVariants,
  eq,
  and,
  desc,
  ilike,
  or,
  sql,
  inArray,
} from "@essencia/db";
import type { CreateInterestRequestDto } from "./dto/create-interest-request.dto";
import type { InterestFiltersDto } from "./dto/interest-filters.dto";

@Injectable()
export class ShopInterestService {
  private readonly logger = new Logger(ShopInterestService.name);

  /**
   * Cria uma nova requisição de interesse (público)
   */
  async createInterestRequest(dto: CreateInterestRequestDto) {
    const db = getDb();
    this.logger.log(
      `Creating interest request for customer: ${dto.customerName}`,
    );

    // Validar que todos os variants existem e pertencem à unidade
    const variantIds = dto.items.map((i) => i.variantId);
    const variants = await db.query.shopProductVariants.findMany({
      where: inArray(shopProductVariants.id, variantIds),
      with: {
        product: true,
      },
    });

    if (variants.length !== variantIds.length) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Um ou mais produtos não foram encontrados",
      });
    }

    // Verificar se todos pertencem à mesma unidade
    type VariantWithProduct = (typeof variants)[number];
    const invalidVariants = variants.filter(
      (v: VariantWithProduct) => v.product?.unitId !== dto.unitId,
    );
    if (invalidVariants.length > 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Produtos pertencem a unidades diferentes",
      });
    }

    // Criar requisição
    const [request] = await db
      .insert(shopInterestRequests)
      .values({
        unitId: dto.unitId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        customerEmail: dto.customerEmail || null,
        studentName: dto.studentName,
        studentClass: dto.studentClass || null,
        notes: dto.notes || null,
        status: "PENDENTE",
      })
      .returning();

    this.logger.log(`Interest request created: ${request.id}`);

    // Criar itens
    const itemsToInsert = dto.items.map((item) => ({
      interestRequestId: request.id,
      variantId: item.variantId,
      quantity: item.quantity,
    }));

    await db.insert(shopInterestItems).values(itemsToInsert);

    this.logger.log(`Created ${itemsToInsert.length} interest items`);

    return {
      requestId: request.id,
      message:
        "Obrigado! Entraremos em contato assim que os produtos estiverem disponíveis.",
    };
  }

  /**
   * Lista requisições de interesse com filtros (admin)
   */
  async getInterestRequests(
    unitId: string,
    filters: InterestFiltersDto = {} as InterestFiltersDto,
  ) {
    const db = getDb();
    const { status = "TODOS", search = "", page = 1, limit = 20 } = filters;

    const offset = (page - 1) * limit;

    // Build where conditions
    const conditions = [eq(shopInterestRequests.unitId, unitId)];

    if (status !== "TODOS") {
      conditions.push(eq(shopInterestRequests.status, status));
    }

    if (search.trim()) {
      conditions.push(
        or(
          ilike(shopInterestRequests.customerName, `%${search}%`),
          ilike(shopInterestRequests.customerPhone, `%${search}%`),
          ilike(shopInterestRequests.studentName, `%${search}%`),
        )!,
      );
    }

    // Fetch requests with items
    const requests = await db.query.shopInterestRequests.findMany({
      where: and(...conditions),
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
        contactedBy: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: desc(shopInterestRequests.createdAt),
      limit,
      offset,
    });

    // Count total
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(shopInterestRequests)
      .where(and(...conditions));

    const totalPages = Math.ceil(count / limit);

    return {
      data: requests,
      meta: {
        pagination: {
          page,
          limit,
          total: count,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    };
  }

  /**
   * Marca requisição como contatada (admin)
   */
  async markAsContacted(requestId: string, userId: string) {
    const db = getDb();
    const request = await db.query.shopInterestRequests.findFirst({
      where: eq(shopInterestRequests.id, requestId),
    });

    if (!request) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Requisição de interesse não encontrada",
      });
    }

    const [updated] = await db
      .update(shopInterestRequests)
      .set({
        status: "CONTATADO",
        contactedAt: new Date(),
        contactedBy: userId,
      })
      .where(eq(shopInterestRequests.id, requestId))
      .returning();

    this.logger.log(
      `Interest request ${requestId} marked as contacted by user ${userId}`,
    );

    return updated;
  }

  /**
   * Retorna resumo de interesse para a unidade (admin)
   */
  async getInterestSummary(unitId: string) {
    const db = getDb();
    // Buscar variantes mais procuradas (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topVariants = await db
      .select({
        variantId: shopInterestItems.variantId,
        productName: shopProducts.name,
        variantSize: shopProductVariants.size,
        totalQuantity: sql<number>`sum(${shopInterestItems.quantity})`,
        requestCount: sql<number>`count(distinct ${shopInterestItems.interestRequestId})`,
      })
      .from(shopInterestItems)
      .innerJoin(
        shopInterestRequests,
        eq(shopInterestItems.interestRequestId, shopInterestRequests.id),
      )
      .innerJoin(
        shopProductVariants,
        eq(shopInterestItems.variantId, shopProductVariants.id),
      )
      .innerJoin(
        shopProducts,
        eq(shopProductVariants.productId, shopProducts.id),
      )
      .where(
        and(
          eq(shopInterestRequests.unitId, unitId),
          sql`${shopInterestRequests.createdAt} >= ${thirtyDaysAgo}`,
        ),
      )
      .groupBy(
        shopInterestItems.variantId,
        shopProducts.name,
        shopProductVariants.size,
      )
      .orderBy(desc(sql`sum(${shopInterestItems.quantity})`))
      .limit(10);

    // Contar requisições por status
    const statusCounts = await db
      .select({
        status: shopInterestRequests.status,
        count: sql<number>`count(*)`,
      })
      .from(shopInterestRequests)
      .where(eq(shopInterestRequests.unitId, unitId))
      .groupBy(shopInterestRequests.status);

    type StatusCountRow = (typeof statusCounts)[number];

    return {
      topVariants,
      statusCounts: statusCounts.reduce<Record<string, number>>(
        (acc: Record<string, number>, item: StatusCountRow) => {
          if (item.status) {
            acc[item.status] = Number(item.count);
          }
          return acc;
        },
        {},
      ),
    };
  }
}
