import {
  IsUUID,
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  IsEnum,
} from "class-validator";

/**
 * DTO para criar produto
 * POST /shop/admin/products
 */
export class CreateProductDto {
  @IsUUID()
  schoolId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(["UNIFORME_DIARIO", "UNIFORME_EDUCACAO_FISICA", "ACESSORIO"])
  category!: "UNIFORME_DIARIO" | "UNIFORME_EDUCACAO_FISICA" | "ACESSORIO";

  @IsInt()
  @Min(0)
  basePrice!: number; // Em centavos

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO para atualizar produto
 * PATCH /shop/admin/products/:id
 */
export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(["UNIFORME_DIARIO", "UNIFORME_EDUCACAO_FISICA", "ACESSORIO"])
  category?: "UNIFORME_DIARIO" | "UNIFORME_EDUCACAO_FISICA" | "ACESSORIO";

  @IsOptional()
  @IsInt()
  @Min(0)
  basePrice?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO para filtros de catálogo
 * GET /shop/catalog/:schoolId/:unitId?category=...&size=...
 */
export class CatalogFiltersDto {
  @IsOptional()
  @IsEnum(["UNIFORME_DIARIO", "UNIFORME_EDUCACAO_FISICA", "ACESSORIO"])
  category?: "UNIFORME_DIARIO" | "UNIFORME_EDUCACAO_FISICA" | "ACESSORIO";

  @IsOptional()
  @IsString()
  size?: string; // "2", "4", "6", etc

  @IsOptional()
  @IsBoolean()
  inStock?: boolean; // Filtrar apenas com estoque disponível
}
