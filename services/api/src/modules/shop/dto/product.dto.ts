import {
  IsUUID,
  IsString,
  IsInt,
  IsBoolean,
  IsOptional,
  Min,
  IsEnum,
  IsArray,
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

  @IsEnum([
    "UNIFORME_FEMININO",
    "UNIFORME_MASCULINO",
    "UNIFORME_UNISSEX",
    "ACESSORIO",
  ])
  category!:
    | "UNIFORME_FEMININO"
    | "UNIFORME_MASCULINO"
    | "UNIFORME_UNISSEX"
    | "ACESSORIO";

  @IsInt()
  @Min(1)
  basePrice!: number; // Em centavos

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

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
  @IsEnum([
    "UNIFORME_FEMININO",
    "UNIFORME_MASCULINO",
    "UNIFORME_UNISSEX",
    "ACESSORIO",
  ])
  category?:
    | "UNIFORME_FEMININO"
    | "UNIFORME_MASCULINO"
    | "UNIFORME_UNISSEX"
    | "ACESSORIO";

  @IsOptional()
  @IsInt()
  @Min(1)
  basePrice?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];

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
  @IsEnum([
    "UNIFORME_FEMININO",
    "UNIFORME_MASCULINO",
    "UNIFORME_UNISSEX",
    "ACESSORIO",
  ])
  category?:
    | "UNIFORME_FEMININO"
    | "UNIFORME_MASCULINO"
    | "UNIFORME_UNISSEX"
    | "ACESSORIO";

  @IsOptional()
  @IsString()
  size?: string; // "2", "4", "6", etc

  @IsOptional()
  @IsBoolean()
  inStock?: boolean; // Filtrar apenas com estoque disponível

  @IsOptional()
  @IsEnum(["PRONTA_ENTREGA", "PRE_VENDA"])
  modoVenda?: "PRONTA_ENTREGA" | "PRE_VENDA";
}
