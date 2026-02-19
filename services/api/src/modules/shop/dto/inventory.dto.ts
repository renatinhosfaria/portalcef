import {
  IsUUID,
  IsInt,
  IsString,
  IsOptional,
  IsEnum,
  Min,
} from "class-validator";

/**
 * DTO para entrada de estoque
 * POST /shop/admin/inventory/entry
 */
export class InventoryEntryDto {
  @IsUUID()
  variantId!: string;

  @IsUUID()
  unitId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsOptional()
  @IsString()
  notes?: string; // Ex: "Reposição fornecedor X"
}

/**
 * DTO para ajuste de estoque
 * POST /shop/admin/inventory/adjust
 */
export class InventoryAdjustDto {
  @IsUUID()
  variantId!: string;

  @IsUUID()
  unitId!: string;

  @IsInt()
  quantityChange!: number; // Pode ser negativo

  @IsString()
  notes!: string; // Motivo obrigatório para ajustes

  @IsEnum(["AJUSTE", "DANO", "PERDA", "INVENTARIO"])
  reason!: "AJUSTE" | "DANO" | "PERDA" | "INVENTARIO";
}

/**
 * DTO para saída manual de estoque
 * POST /shop/admin/inventory/exit
 */
export class InventoryExitDto {
  @IsUUID()
  variantId!: string;

  @IsUUID()
  unitId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsString()
  notes!: string; // Motivo obrigatório para saída

  @IsEnum(["VENDA_BALCAO", "DANO", "PERDA", "AMOSTRA", "OUTROS"])
  reason!: "VENDA_BALCAO" | "DANO" | "PERDA" | "AMOSTRA" | "OUTROS";
}
