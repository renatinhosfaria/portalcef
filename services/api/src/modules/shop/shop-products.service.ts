import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import {
  getDb,
  shopProducts,
  shopProductVariants,
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

type ProductInventory = typeof shopInventory.$inferSelect;
type ProductVariantWithInventory = typeof shopProductVariants.$inferSelect & {
  inventory: ProductInventory[];
};
type ProductWithVariants = typeof shopProducts.$inferSelect & {
  variants: ProductVariantWithInventory[];
};

/**
 * ShopProductsService
 *
 * Serviço para gestão de produtos do shop
 * Queries Drizzle ORM com joins e filtros
 */
@Injectable()
export class ShopProductsService {
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
          where: eq(shopProductVariants.isActive, true),
          with: {
            inventory: true,
          },
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

    // Insert product
    const [product] = await db
      .insert(shopProducts)
      .values({
        schoolId: dto.schoolId,
        name: dto.name,
        description: dto.description || null,
        category: dto.category,
        basePrice: dto.basePrice,
        imageUrl: dto.imageUrl || null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      })
      .returning();

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
    if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Nenhum campo para atualizar",
      });
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
   * Remove produto (soft delete - marca isActive=false)
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

    // Soft delete
    await db
      .update(shopProducts)
      .set({ isActive: false })
      .where(eq(shopProducts.id, id));
  }
}
