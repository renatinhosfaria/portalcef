import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
} from "@nestjs/common";
import { MultipartFile } from "@fastify/multipart";
import {
  getDb,
  shopProducts,
  shopProductVariants,
  shopProductImages,
  shopInventory,
  shopOrderItems,
  shopSettings,
  units,
  eq,
  and,
  asc,
  inArray,
} from "@essencia/db";
import type {
  CreateProductDto,
  UpdateProductDto,
  CatalogFiltersDto,
} from "./dto";
import {
  RASTER_IMAGE_MIME_TYPES,
  StorageService,
} from "../../common/storage/storage.service";
import {
  assertShopTenantScope,
  canAccessShopSchool,
  isMasterShopScope,
  type ShopTenantScope,
} from "./shop-tenant-scope";

type ProductInventory = typeof shopInventory.$inferSelect;
type ProductVariantWithInventory = typeof shopProductVariants.$inferSelect & {
  inventory: ProductInventory[];
};
type ProductWithVariants = typeof shopProducts.$inferSelect & {
  variants: ProductVariantWithInventory[];
  images: (typeof shopProductImages.$inferSelect)[];
};
type ModoVenda = "PRONTA_ENTREGA" | "PRE_VENDA";
type Db = ReturnType<typeof getDb>;
type DbTransaction = Parameters<Db["transaction"]>[0] extends (
  tx: infer T,
) => Promise<unknown>
  ? T
  : never;

/**
 * ShopProductsService
 *
 * Serviço para gestão de produtos do shop
 * Queries Drizzle ORM com joins e filtros
 */
@Injectable()
export class ShopProductsService {
  constructor(
    @Optional()
    @Inject(StorageService)
    private readonly storageService?: StorageService,
  ) {}

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

  private async assertPublicUnitBelongsToSchool(
    schoolId: string,
    unitId: string,
  ) {
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

  private productWhere(id: string, scope?: ShopTenantScope) {
    if (isMasterShopScope(scope)) {
      return eq(shopProducts.id, id);
    }

    assertShopTenantScope(scope);
    return and(
      eq(shopProducts.id, id),
      eq(shopProducts.schoolId, scope!.schoolId!),
    );
  }

  private assertProductSchoolAccess(
    schoolId: string,
    scope?: ShopTenantScope,
  ) {
    assertShopTenantScope(scope);
    if (!canAccessShopSchool(scope, schoolId)) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Produto não encontrado",
      });
    }
  }

  private getModoVenda(available: number): ModoVenda {
    return available > 0 ? "PRONTA_ENTREGA" : "PRE_VENDA";
  }

  /**
   * GET /shop/catalog/:schoolId/:unitId
   *
   * Retorna produtos com variantes e estoque disponível
   * Filtra por category, size, inStock
   */
  async getProducts(
    schoolId: string,
    unitId: string,
    filters: CatalogFiltersDto,
  ) {
    const db = getDb();
    await this.assertPublicUnitBelongsToSchool(schoolId, unitId);
    await this.assertShopEnabled(unitId);

    // Build query filters
    const productFilters = [
      eq(shopProducts.schoolId, schoolId),
      eq(shopProducts.isActive, true),
    ];

    if (filters.category) {
      productFilters.push(eq(shopProducts.category, filters.category));
    }

    // Get products
    const products = (await db.query.shopProducts.findMany({
      where: and(...productFilters),
      with: {
        variants: {
          where: eq(shopProductVariants.isActive, true),
          with: {
            inventory: {
              where: eq(shopInventory.unitId, unitId),
            },
          },
        },
        images: {
          orderBy: asc(shopProductImages.displayOrder),
        },
      },
      orderBy: [asc(shopProducts.name)],
    })) as ProductWithVariants[];

    // Transform and filter
    const result = products
      .map((product: ProductWithVariants) => {
        const variants = product.variants
          .filter((variant: ProductVariantWithInventory) => {
            const inv = variant.inventory?.[0];
            const available = inv ? inv.quantity - inv.reservedQuantity : 0;
            const modoVenda = this.getModoVenda(available);

            // Filter by size if requested
            if (filters.size && variant.size !== filters.size) {
              return false;
            }

            // Filter by stock if requested
            if (filters.inStock && available <= 0) {
              return false;
            }

            if (filters.modoVenda && filters.modoVenda !== modoVenda) {
              return false;
            }

            return true;
          })
          .map((variant: ProductVariantWithInventory) => {
            const inv = variant.inventory?.[0];
            const available = inv ? inv.quantity - inv.reservedQuantity : 0;
            const modoVenda = this.getModoVenda(available);

            return {
              id: variant.id,
              size: variant.size,
              sku: variant.sku,
              price: variant.priceOverride || product.basePrice,
              availableStock: Math.max(0, available),
              isAvailable: available > 0,
              modoVenda,
            };
          });

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          basePrice: product.basePrice,
          imageUrl: product.imageUrl,
          images:
            product.images?.map((img: { imageUrl: string }) => img.imageUrl) ||
            [],
          variants,
        };
      })
      .filter((p: ProductWithVariants) => p.variants.length > 0); // Remove products sem variantes dispon?veis

    return result;
  }

  /**
   * GET /shop/products/:id
   *
   * Retorna detalhe de um produto com todas as variantes
   */
  async getProductById(id: string, scope?: ShopTenantScope) {
    const db = getDb();

    const product = (await db.query.shopProducts.findFirst({
      where: this.productWhere(id, scope),
      with: {
        variants: {
          with: {
            inventory: true,
          },
        },
        images: {
          orderBy: asc(shopProductImages.displayOrder),
        },
      },
    })) as ProductWithVariants | null;

    if (!product) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Produto não encontrado",
      });
    }

    // Transform variants with inventory by unit
    const variants = product.variants.map(
      (variant: ProductVariantWithInventory) => {
        const inventory =
          scope?.unitId && !isMasterShopScope(scope)
            ? variant.inventory.filter(
                (inv: ProductInventory) => inv.unitId === scope.unitId,
              )
            : variant.inventory;

        return {
          id: variant.id,
          size: variant.size,
          sku: variant.sku,
          priceOverride: variant.priceOverride,
          isActive: variant.isActive,
          price: variant.priceOverride || product.basePrice,
          inventory: inventory.map((inv: ProductInventory) => ({
            unitId: inv.unitId,
            available: Math.max(0, inv.quantity - inv.reservedQuantity),
            total: inv.quantity,
            reserved: inv.reservedQuantity,
          })),
        };
      },
    );

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      basePrice: product.basePrice,
      imageUrl: product.imageUrl,
      images: product.images.map((img: { imageUrl: string }) => img.imageUrl),
      isActive: product.isActive,
      variants,
    };
  }

  /**
   * GET /shop/products/:id?schoolId=:schoolId&unitId=:unitId
   *
   * Retorna detalhe publico sem expor estoque interno.
   */
  async getPublicProductById(id: string, schoolId: string, unitId: string) {
    const db = getDb();
    await this.assertPublicUnitBelongsToSchool(schoolId, unitId);
    await this.assertShopEnabled(unitId);

    const product = (await db.query.shopProducts.findFirst({
      where: and(
        eq(shopProducts.id, id),
        eq(shopProducts.schoolId, schoolId),
        eq(shopProducts.isActive, true),
      ),
      with: {
        variants: {
          where: eq(shopProductVariants.isActive, true),
          with: {
            inventory: {
              where: eq(shopInventory.unitId, unitId),
            },
          },
        },
        images: {
          orderBy: asc(shopProductImages.displayOrder),
        },
      },
    })) as ProductWithVariants | null;

    if (!product) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Produto não encontrado",
      });
    }

    const variants = product.variants
      .filter((variant: ProductVariantWithInventory) => variant.isActive)
      .map((variant: ProductVariantWithInventory) => {
        const inv = variant.inventory?.[0];
        const available = inv ? inv.quantity - inv.reservedQuantity : 0;

        return {
          id: variant.id,
          size: variant.size,
          sku: variant.sku,
          priceOverride: variant.priceOverride,
          price: variant.priceOverride || product.basePrice,
          availableStock: Math.max(0, available),
          isAvailable: available > 0,
        };
      });

    return {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      basePrice: product.basePrice,
      imageUrl: product.imageUrl,
      images: product.images.map((img: { imageUrl: string }) => img.imageUrl),
      variants,
    };
  }

  /**
   * POST /shop/admin/products
   *
   * Cria novo produto
   */
  async createProduct(
    dto: CreateProductDto,
    _userId: string,
    scope?: ShopTenantScope,
  ) {
    const db = getDb();
    const schoolId = isMasterShopScope(scope) ? dto.schoolId : scope!.schoolId!;

    if (!schoolId || dto.schoolId !== schoolId) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Escola não encontrada",
      });
    }

    // Use first image as main imageUrl if provided
    const mainImageUrl = dto.images?.length ? dto.images[0] : dto.imageUrl;

    return db.transaction(async (tx: DbTransaction) => {
      const [product] = await tx
        .insert(shopProducts)
        .values({
          schoolId,
          name: dto.name,
          description: dto.description || null,
          category: dto.category,
          basePrice: dto.basePrice,
          imageUrl: mainImageUrl || null,
          isActive: dto.isActive !== undefined ? dto.isActive : true,
        })
        .returning();

      if (dto.images && dto.images.length > 0) {
        await tx.insert(shopProductImages).values(
          dto.images.map((url, index) => ({
            productId: product.id,
            imageUrl: url,
            displayOrder: index,
          })),
        );
      }

      return product;
    });
  }

  /**
   * PATCH /shop/admin/products/:id
   *
   * Atualiza produto existente
   */
  async updateProduct(
    id: string,
    dto: UpdateProductDto,
    _userId: string,
    scope?: ShopTenantScope,
  ) {
    const db = getDb();

    // Check if product exists
    const existing = await db.query.shopProducts.findFirst({
      where: this.productWhere(id, scope),
    });

    if (!existing) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Produto não encontrado",
      });
    }

    // Build update object
    const updateData: Partial<typeof shopProducts.$inferInsert> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.category !== undefined) updateData.category = dto.category;
    if (dto.basePrice !== undefined) updateData.basePrice = dto.basePrice;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // Handle images if provided
    if (dto.images !== undefined) {
      updateData.imageUrl = dto.images[0] ?? null;
    } else if (dto.imageUrl !== undefined) {
      updateData.imageUrl = dto.imageUrl;
    }

    if (Object.keys(updateData).length === 0 && !dto.images) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Nenhum campo para atualizar",
      });
    }

    return db.transaction(async (tx: DbTransaction) => {
      if (dto.images !== undefined) {
        await tx
          .delete(shopProductImages)
          .where(eq(shopProductImages.productId, id));

        if (dto.images.length > 0) {
          await tx.insert(shopProductImages).values(
            dto.images.map((url, index) => ({
              productId: id,
              imageUrl: url,
              displayOrder: index,
            })),
          );
        }
      }

      const [updated] = await tx
        .update(shopProducts)
        .set(updateData)
        .where(this.productWhere(id, scope))
        .returning();

      return updated;
    });
  }

  /**
   * DELETE /shop/admin/products/:id
   *
   * Desativa produto e variantes sem apagar histórico de estoque
   */
  async deleteProduct(id: string, _userId: string, scope?: ShopTenantScope) {
    const db = getDb();

    // Check if product exists
    const existing = await db.query.shopProducts.findFirst({
      where: this.productWhere(id, scope),
      with: {
        variants: true,
      },
    });

    if (!existing) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Produto não encontrado",
      });
    }

    // Check for existing orders
    const variantIds = existing.variants.map((v: { id: string }) => v.id);
    if (variantIds.length > 0) {
      const existingOrders = await db.query.shopOrderItems.findFirst({
        where: inArray(shopOrderItems.variantId, variantIds),
      });

      if (existingOrders) {
        throw new BadRequestException({
          code: "PRODUCT_HAS_ORDERS",
          message:
            "Não é possível excluir este produto pois ele possui pedidos associados. Desative-o em vez de excluir.",
        });
      }
    }

    await db.transaction(async (tx: DbTransaction) => {
      const now = new Date();

      if (variantIds.length > 0) {
        await tx
          .update(shopProductVariants)
          .set({ isActive: false, updatedAt: now })
          .where(inArray(shopProductVariants.id, variantIds));
      }

      await tx
        .update(shopProducts)
        .set({ isActive: false, updatedAt: now })
        .where(this.productWhere(id, scope));
    });
  }

  /**
   * POST /shop/admin/products/:id/upload-image
   *
   * Upload de imagem do produto para MinIO
   * Recebe um MultipartFile do Fastify
   */
  async uploadProductImage(
    productId: string,
    file: MultipartFile,
    scope?: ShopTenantScope,
  ): Promise<string> {
    const db = getDb();

    // Verificar se produto existe
    const product = await db.query.shopProducts.findFirst({
      where: this.productWhere(productId, scope),
    });

    if (!product) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Produto não encontrado",
      });
    }

    try {
      if (!this.storageService) {
        throw new Error("Storage service is not configured");
      }
      // Upload para MinIO usando o StorageService
      const result = await this.storageService.uploadFile(file, {
        allowedMimeTypes: RASTER_IMAGE_MIME_TYPES,
      });
      const imageUrl = result.url;

      // Atualizar produto com nova imageUrl
      await db
        .update(shopProducts)
        .set({ imageUrl })
        .where(eq(shopProducts.id, productId));

      return imageUrl;
    } catch (error) {
      throw new BadRequestException({
        code: "UPLOAD_ERROR",
        message: `Erro ao fazer upload: ${error instanceof Error ? error.message : "Erro desconhecido"}`,
      });
    }
  }

  // ==================== VARIANTES ====================

  /**
   * POST /shop/admin/variants
   *
   * Cria nova variante de produto
   */
  async createVariant(
    dto: {
      productId: string;
      size: string;
      sku?: string;
      priceOverride?: number;
    },
    _userId: string,
    unitId?: string,
    scope?: ShopTenantScope,
  ) {
    const db = getDb();

    // Verificar se produto existe
    const product = await db.query.shopProducts.findFirst({
      where: this.productWhere(dto.productId, scope),
    });

    if (!product) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Produto não encontrado",
      });
    }

    // Verificar se já existe variante com esse tamanho
    const existing = await db.query.shopProductVariants.findFirst({
      where: and(
        eq(shopProductVariants.productId, dto.productId),
        eq(shopProductVariants.size, dto.size),
      ),
    });

    if (existing) {
      throw new BadRequestException({
        code: "VARIANT_EXISTS",
        message: `Já existe uma variante com tamanho ${dto.size}`,
      });
    }

    return db.transaction(async (tx: DbTransaction) => {
      const [variant] = await tx
        .insert(shopProductVariants)
        .values({
          productId: dto.productId,
          size: dto.size,
          sku: dto.sku || null,
          priceOverride: dto.priceOverride || null,
          isActive: true,
        })
        .returning();

      // Auto-criar entrada de inventário se unitId foi fornecido
      if (unitId) {
        await tx
          .insert(shopInventory)
          .values({
            variantId: variant.id,
            unitId: unitId,
            quantity: 0,
            reservedQuantity: 0,
            lowStockThreshold: 5,
          })
          .onConflictDoNothing();
      }

      return variant;
    });
  }

  /**
   * PATCH /shop/admin/variants/:id
   *
   * Atualiza variante existente
   */
  async updateVariant(
    id: string,
    dto: {
      size?: string;
      sku?: string;
      priceOverride?: number;
      isActive?: boolean;
    },
    _userId: string,
    scope?: ShopTenantScope,
  ) {
    const db = getDb();

    // Verificar se variante existe
    const existing = await db.query.shopProductVariants.findFirst({
      where: eq(shopProductVariants.id, id),
      with: {
        product: true,
      },
    });

    if (!existing || !existing.product) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Variante não encontrada",
      });
    }
    this.assertProductSchoolAccess(existing.product.schoolId, scope);

    if (dto.size && dto.size !== existing.size) {
      const duplicate = await db.query.shopProductVariants.findFirst({
        where: and(
          eq(shopProductVariants.productId, existing.productId),
          eq(shopProductVariants.size, dto.size),
        ),
      });

      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException({
          code: "VARIANT_EXISTS",
          message: "Já existe uma variante com este tamanho para o produto",
        });
      }
    }

    const [updated] = await db
      .update(shopProductVariants)
      .set({
        ...(dto.size && { size: dto.size }),
        ...(dto.sku !== undefined && { sku: dto.sku || null }),
        ...(dto.priceOverride !== undefined && {
          priceOverride: dto.priceOverride || null,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        updatedAt: new Date(),
      })
      .where(eq(shopProductVariants.id, id))
      .returning();

    return updated;
  }

  /**
   * DELETE /shop/admin/variants/:id
   *
   * Desativa variante sem apagar inventário e ledger
   */
  async deleteVariant(id: string, _userId: string, scope?: ShopTenantScope) {
    const db = getDb();

    // Verificar se variante existe
    const existing = await db.query.shopProductVariants.findFirst({
      where: eq(shopProductVariants.id, id),
      with: {
        product: true,
      },
    });

    if (!existing || !existing.product) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Variante não encontrada",
      });
    }
    this.assertProductSchoolAccess(existing.product.schoolId, scope);

    const orderItem = await db.query.shopOrderItems.findFirst({
      where: eq(shopOrderItems.variantId, id),
    });

    if (orderItem) {
      throw new BadRequestException({
        code: "VARIANT_HAS_ORDERS",
        message:
          "Não é possível excluir esta variante pois ela possui pedidos associados. Desative-a em vez de excluir.",
      });
    }

    await db
      .update(shopProductVariants)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(shopProductVariants.id, id));
  }
}
