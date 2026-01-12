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
  eq,
  and,
  asc,
} from "@essencia/db";
import type {
  CreateProductDto,
  UpdateProductDto,
  CatalogFiltersDto,
} from "./dto";
import { StorageService } from "../../common/storage/storage.service";

type ProductInventory = typeof shopInventory.$inferSelect;
type ProductVariantWithInventory = typeof shopProductVariants.$inferSelect & {
  inventory: ProductInventory[];
};
type ProductWithVariants = typeof shopProducts.$inferSelect & {
  variants: ProductVariantWithInventory[];
  images: (typeof shopProductImages.$inferSelect)[];
};

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
  ) { }

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
            // Filter by size if requested
            if (filters.size && variant.size !== filters.size) {
              return false;
            }

            // Filter by stock if requested
            if (filters.inStock) {
              const inv = variant.inventory?.[0];
              if (!inv) return false;
              const available = inv.quantity - inv.reservedQuantity;
              return available > 0;
            }

            return true;
          })
          .map((variant: ProductVariantWithInventory) => {
            const inv = variant.inventory?.[0];
            const available = inv ? inv.quantity - inv.reservedQuantity : 0;

            return {
              id: variant.id,
              size: variant.size,
              sku: variant.sku,
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
          images: product.images?.map((img: { imageUrl: string }) => img.imageUrl) || [],
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
  async getProductById(id: string) {
    const db = getDb();

    const product = (await db.query.shopProducts.findFirst({
      where: eq(shopProducts.id, id),
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
      (variant: ProductVariantWithInventory) => ({
        id: variant.id,
        size: variant.size,
        sku: variant.sku,
        priceOverride: variant.priceOverride,
        isActive: variant.isActive,
        price: variant.priceOverride || product.basePrice,
        inventory: variant.inventory.map((inv: ProductInventory) => ({
          unitId: inv.unitId,
          available: Math.max(0, inv.quantity - inv.reservedQuantity),
          total: inv.quantity,
          reserved: inv.reservedQuantity,
        })),
      }),
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
   * POST /shop/admin/products
   *
   * Cria novo produto
   */
  async createProduct(dto: CreateProductDto, _userId: string) {
    const db = getDb();

    // Use first image as main imageUrl if provided
    const mainImageUrl = dto.images?.length ? dto.images[0] : dto.imageUrl;

    // Insert product
    const [product] = await db
      .insert(shopProducts)
      .values({
        schoolId: dto.schoolId,
        name: dto.name,
        description: dto.description || null,
        category: dto.category,
        basePrice: dto.basePrice,
        imageUrl: mainImageUrl || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      })
      .returning();

    // Insert images if provided
    if (dto.images && dto.images.length > 0) {
      await db.insert(shopProductImages).values(
        dto.images.map((url, index) => ({
          productId: product.id,
          imageUrl: url,
          displayOrder: index,
        })),
      );
    }

    return product;
  }

  /**
   * PATCH /shop/admin/products/:id
   *
   * Atualiza produto existente
   */
  async updateProduct(id: string, dto: UpdateProductDto, _userId: string) {
    const db = getDb();

    // Check if product exists
    const existing = await db.query.shopProducts.findFirst({
      where: eq(shopProducts.id, id),
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
    if (dto.images && dto.images.length > 0) {
      updateData.imageUrl = dto.images[0];
    } else if (dto.imageUrl !== undefined) {
      updateData.imageUrl = dto.imageUrl;
    }

    if (Object.keys(updateData).length === 0 && !dto.images) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Nenhum campo para atualizar",
      });
    }

    // Sync images if provided
    if (dto.images) {
      // 1. Delete existing images
      await db
        .delete(shopProductImages)
        .where(eq(shopProductImages.productId, id));

      // 2. Insert new images
      if (dto.images.length > 0) {
        await db.insert(shopProductImages).values(
          dto.images.map((url, index) => ({
            productId: id,
            imageUrl: url,
            displayOrder: index,
          })),
        );
      }
    }

    const [updated] = await db
      .update(shopProducts)
      .set(updateData)
      .where(eq(shopProducts.id, id))
      .returning();

    return updated;
  }

  /**
   * DELETE /shop/admin/products/:id
   *
   * Remove produto permanentemente do banco de dados
   */
  async deleteProduct(id: string, _userId: string) {
    const db = getDb();

    // Check if product exists
    const existing = await db.query.shopProducts.findFirst({
      where: eq(shopProducts.id, id),
    });

    if (!existing) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Produto não encontrado",
      });
    }

    // Hard delete - remove permanentemente
    await db
      .delete(shopProducts)
      .where(eq(shopProducts.id, id));
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
  ): Promise<string> {
    const db = getDb();

    // Verificar se produto existe
    const product = await db.query.shopProducts.findFirst({
      where: eq(shopProducts.id, productId),
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
      const result = await this.storageService.uploadFile(file);
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
    dto: { productId: string; size: string; sku?: string; priceOverride?: number },
    _userId: string,
    unitId?: string,
  ) {
    const db = getDb();

    // Verificar se produto existe
    const product = await db.query.shopProducts.findFirst({
      where: eq(shopProducts.id, dto.productId),
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

    const [variant] = await db
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
      await db
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
  }

  /**
   * PATCH /shop/admin/variants/:id
   *
   * Atualiza variante existente
   */
  async updateVariant(
    id: string,
    dto: { size?: string; sku?: string; priceOverride?: number; isActive?: boolean },
    _userId: string,
  ) {
    const db = getDb();

    // Verificar se variante existe
    const existing = await db.query.shopProductVariants.findFirst({
      where: eq(shopProductVariants.id, id),
    });

    if (!existing) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Variante não encontrada",
      });
    }

    const [updated] = await db
      .update(shopProductVariants)
      .set({
        ...(dto.size && { size: dto.size }),
        ...(dto.sku !== undefined && { sku: dto.sku || null }),
        ...(dto.priceOverride !== undefined && { priceOverride: dto.priceOverride || null }),
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
   * Remove variante permanentemente
   */
  async deleteVariant(id: string, _userId: string) {
    const db = getDb();

    // Verificar se variante existe
    const existing = await db.query.shopProductVariants.findFirst({
      where: eq(shopProductVariants.id, id),
    });

    if (!existing) {
      throw new NotFoundException({
        code: "RESOURCE_NOT_FOUND",
        message: "Variante não encontrada",
      });
    }

    // Hard delete
    await db.delete(shopProductVariants).where(eq(shopProductVariants.id, id));
  }
}
