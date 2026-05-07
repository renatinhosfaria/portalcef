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
  users,
  units,
  eq,
  and,
  desc,
  gte,
  ilike,
  or,
  sql,
  inArray,
} from "@essencia/db";
import type { CreateInterestRequestDto } from "./dto/create-interest-request.dto";
import type { InterestFiltersDto } from "./dto/interest-filters.dto";
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

    if (!dto.items?.length) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Informe ao menos um item de interesse",
      });
    }

    const unit = await db.query.units.findFirst({
      where: and(eq(units.id, dto.unitId), eq(units.schoolId, dto.schoolId)),
    });

    if (!unit) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Unidade não encontrada para a escola informada",
      });
    }

    // Validar que todos os variants existem e pertencem à escola
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

    // Verificar se todos pertencem à mesma escola e continuam ativos
    type VariantWithProduct = (typeof variants)[number];
    const invalidVariants = variants.filter(
      (v: VariantWithProduct) =>
        !v.isActive ||
        !v.product?.isActive ||
        v.product.schoolId !== dto.schoolId,
    );
    if (invalidVariants.length > 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Produtos inválidos para a escola informada",
      });
    }

    return db.transaction(async (tx: DbTransaction) => {
      const [request] = await tx
        .insert(shopInterestRequests)
        .values({
          schoolId: dto.schoolId,
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

      const itemsToInsert = dto.items.map((item) => ({
        interestRequestId: request.id,
        variantId: item.variantId,
        quantity: item.quantity,
      }));

      await tx.insert(shopInterestItems).values(itemsToInsert);

      this.logger.log(`Created ${itemsToInsert.length} interest items`);

      return {
        requestId: request.id,
        message:
          "Obrigado! Entraremos em contato assim que os produtos estiverem disponíveis.",
      };
    });
  }

  /**
   * Lista requisições de interesse com filtros (admin)
   */
  async getInterestRequests(
    unitId: string | null,
    filters: InterestFiltersDto = {} as InterestFiltersDto,
    scope?: ShopTenantScope,
  ) {
    const db = getDb();
    const { status = "TODOS", search = "", page = 1, limit = 20 } = filters;

    const offset = (page - 1) * limit;

    const buildConditions = (interestRequests: typeof shopInterestRequests) => {
      const currentConditions: ReturnType<typeof eq>[] = [];

      if (!isMasterShopScope(scope)) {
        assertShopTenantScope(scope);
        const scopedTenant = scope!;
        currentConditions.push(
          eq(interestRequests.schoolId, scopedTenant.schoolId!),
        );
        if (scopedTenant.unitId) {
          currentConditions.push(
            eq(interestRequests.unitId, scopedTenant.unitId),
          );
        }
      } else if (unitId) {
        currentConditions.push(eq(interestRequests.unitId, unitId));
      }

      if (status !== "TODOS") {
        currentConditions.push(eq(interestRequests.status, status));
      }

      if (search.trim()) {
        currentConditions.push(
          or(
            ilike(interestRequests.customerName, `%${search}%`),
            ilike(interestRequests.customerPhone, `%${search}%`),
            ilike(interestRequests.studentName, `%${search}%`),
          )!,
        );
      }

      return currentConditions;
    };

    // Build where conditions
    const conditions = buildConditions(shopInterestRequests);

    type InterestRequestListRow = {
      id: string;
      schoolId: string;
      unitId: string;
      customerName: string;
      customerPhone: string;
      customerEmail: string | null;
      studentName: string;
      studentClass: string | null;
      notes: string | null;
      status: string;
      contactedAt: Date | null;
      contactedBy: string | null;
      createdAt: Date;
      contactedByUserId: string | null;
      contactedByUserName: string | null;
    };

    type InterestItemListRow = {
      id: string;
      interestRequestId: string;
      variantId: string;
      quantity: number;
      createdAt: Date;
      variantSize: string;
      variantSku: string | null;
      variantPriceOverride: number | null;
      variantIsActive: boolean;
      productId: string;
      productName: string;
      productDescription: string | null;
      productCategory: string;
      productBasePrice: number;
      productImageUrl: string | null;
      productIsActive: boolean;
    };

    const requestRows = (await db
      .select({
        id: shopInterestRequests.id,
        schoolId: shopInterestRequests.schoolId,
        unitId: shopInterestRequests.unitId,
        customerName: shopInterestRequests.customerName,
        customerPhone: shopInterestRequests.customerPhone,
        customerEmail: shopInterestRequests.customerEmail,
        studentName: shopInterestRequests.studentName,
        studentClass: shopInterestRequests.studentClass,
        notes: shopInterestRequests.notes,
        status: shopInterestRequests.status,
        contactedAt: shopInterestRequests.contactedAt,
        contactedBy: shopInterestRequests.contactedBy,
        createdAt: shopInterestRequests.createdAt,
        contactedByUserId: users.id,
        contactedByUserName: users.name,
      })
      .from(shopInterestRequests)
      .leftJoin(users, eq(shopInterestRequests.contactedBy, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(shopInterestRequests.createdAt))
      .limit(limit)
      .offset(offset)) as InterestRequestListRow[];

    const requestIds = requestRows.map((request) => request.id);
    const itemRows =
      requestIds.length > 0
        ? ((await db
            .select({
              id: shopInterestItems.id,
              interestRequestId: shopInterestItems.interestRequestId,
              variantId: shopInterestItems.variantId,
              quantity: shopInterestItems.quantity,
              createdAt: shopInterestItems.createdAt,
              variantSize: shopProductVariants.size,
              variantSku: shopProductVariants.sku,
              variantPriceOverride: shopProductVariants.priceOverride,
              variantIsActive: shopProductVariants.isActive,
              productId: shopProducts.id,
              productName: shopProducts.name,
              productDescription: shopProducts.description,
              productCategory: shopProducts.category,
              productBasePrice: shopProducts.basePrice,
              productImageUrl: shopProducts.imageUrl,
              productIsActive: shopProducts.isActive,
            })
            .from(shopInterestItems)
            .innerJoin(
              shopProductVariants,
              eq(shopInterestItems.variantId, shopProductVariants.id),
            )
            .innerJoin(
              shopProducts,
              eq(shopProductVariants.productId, shopProducts.id),
            )
            .where(
              inArray(shopInterestItems.interestRequestId, requestIds),
            )) as InterestItemListRow[])
        : [];

    const itemsByRequestId = new Map<string, unknown[]>();
    for (const item of itemRows) {
      const items = itemsByRequestId.get(item.interestRequestId) ?? [];
      items.push({
        id: item.id,
        interestRequestId: item.interestRequestId,
        variantId: item.variantId,
        quantity: item.quantity,
        createdAt: item.createdAt,
        variant: {
          id: item.variantId,
          size: item.variantSize,
          sku: item.variantSku,
          priceOverride: item.variantPriceOverride,
          isActive: item.variantIsActive,
          product: {
            id: item.productId,
            name: item.productName,
            description: item.productDescription,
            category: item.productCategory,
            basePrice: item.productBasePrice,
            imageUrl: item.productImageUrl,
            isActive: item.productIsActive,
          },
        },
      });
      itemsByRequestId.set(item.interestRequestId, items);
    }

    const requests = requestRows.map((request) => ({
      id: request.id,
      schoolId: request.schoolId,
      unitId: request.unitId,
      customerName: request.customerName,
      customerPhone: request.customerPhone,
      customerEmail: request.customerEmail,
      studentName: request.studentName,
      studentClass: request.studentClass,
      notes: request.notes,
      status: request.status,
      contactedAt: request.contactedAt,
      contactedBy: request.contactedBy,
      createdAt: request.createdAt,
      contactedByUser: request.contactedByUserId
        ? {
            id: request.contactedByUserId,
            name: request.contactedByUserName,
          }
        : null,
      items: itemsByRequestId.get(request.id) ?? [],
    }));

    // Count total
    const [{ count }] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(shopInterestRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = Number(count);
    const totalPages = Math.ceil(total / limit);

    return {
      data: requests,
      meta: {
        pagination: {
          page,
          limit,
          total,
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
  async markAsContacted(
    requestId: string,
    userId: string,
    scope?: ShopTenantScope,
  ) {
    const db = getDb();
    const requestConditions = [eq(shopInterestRequests.id, requestId)];
    if (!isMasterShopScope(scope)) {
      assertShopTenantScope(scope);
      const scopedTenant = scope!;
      requestConditions.push(
        eq(shopInterestRequests.schoolId, scopedTenant.schoolId!),
      );
      if (scopedTenant.unitId) {
        requestConditions.push(
          eq(shopInterestRequests.unitId, scopedTenant.unitId),
        );
      }
    }

    const request = await db.query.shopInterestRequests.findFirst({
      where: and(...requestConditions),
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
      .where(and(...requestConditions))
      .returning();

    this.logger.log(
      `Interest request ${requestId} marked as contacted by user ${userId}`,
    );

    return updated;
  }

  /**
   * Retorna resumo de interesse para a unidade (admin)
   */
  async getInterestSummary(unitId: string | null, scope?: ShopTenantScope) {
    const db = getDb();
    // Buscar variantes mais procuradas (últimos 30 dias)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topVariantsConditions: ReturnType<typeof gte>[] = [
      gte(shopInterestRequests.createdAt, thirtyDaysAgo),
    ];
    if (!isMasterShopScope(scope)) {
      assertShopTenantScope(scope);
      const scopedTenant = scope!;
      topVariantsConditions.push(
        eq(shopInterestRequests.schoolId, scopedTenant.schoolId!),
      );
      if (scopedTenant.unitId) {
        topVariantsConditions.push(
          eq(shopInterestRequests.unitId, scopedTenant.unitId),
        );
      }
    } else if (unitId) {
      topVariantsConditions.push(eq(shopInterestRequests.unitId, unitId));
    }

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
      .where(and(...topVariantsConditions))
      .groupBy(
        shopInterestItems.variantId,
        shopProducts.name,
        shopProductVariants.size,
      )
      .orderBy(desc(sql`sum(${shopInterestItems.quantity})`))
      .limit(10);

    // Contar requisições por status
    const statusConditions: ReturnType<typeof eq>[] = [];
    if (!isMasterShopScope(scope)) {
      assertShopTenantScope(scope);
      const scopedTenant = scope!;
      statusConditions.push(
        eq(shopInterestRequests.schoolId, scopedTenant.schoolId!),
      );
      if (scopedTenant.unitId) {
        statusConditions.push(
          eq(shopInterestRequests.unitId, scopedTenant.unitId),
        );
      }
    } else if (unitId) {
      statusConditions.push(eq(shopInterestRequests.unitId, unitId));
    }

    const statusCounts = await db
      .select({
        status: shopInterestRequests.status,
        count: sql<number>`count(*)`,
      })
      .from(shopInterestRequests)
      .where(statusConditions.length > 0 ? and(...statusConditions) : undefined)
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
