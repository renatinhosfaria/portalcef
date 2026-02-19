import {
  IsUUID,
  IsString,
  IsInt,
  IsArray,
  ValidateNested,
  IsOptional,
  IsEnum,
  Min,
  Max,
  ArrayMinSize,
} from "class-validator";
import { Type } from "class-transformer";

/**
 * Item do pedido
 */
export class OrderItemDto {
  @IsString()
  studentName!: string;

  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

/**
 * DTO para criar pedido
 * POST /shop/orders
 */
export class CreateOrderDto {
  @IsUUID()
  schoolId!: string;

  @IsUUID()
  unitId!: string;

  @IsString()
  customerName!: string;

  @IsString()
  customerPhone!: string; // Apenas números: 11999999999

  @IsOptional()
  @IsString()
  customerEmail?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  installments?: number; // Default: 1

  @IsOptional()
  @IsString()
  paymentIntentId?: string; // Se já criou Intent via /checkout/init
}

/**
 * DTO para consultar pedido público
 * GET /shop/orders/:orderNumber?phone=...
 */
export class GetOrderDto {
  @IsString()
  phone!: string; // Validação de acesso
}

/**
 * DTO para listagem admin de pedidos
 * GET /shop/admin/orders
 */
export class ListOrdersDto {
  @IsOptional()
  @IsUUID()
  schoolId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  orderSource?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}


export class PaymentItemDto {
  @IsEnum([
    "DINHEIRO",
    "PIX",
    "CARTAO_CREDITO",
    "CARTAO_DEBITO",
    "BRINDE",
  ])
  method!: "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "BRINDE";

  @IsInt()
  @Min(0)
  amount!: number; // Em centavos
}

/**
 * DTO para venda presencial
 * POST /shop/admin/orders/presencial
 *
 * NOTA: schoolId e unitId são extraídos da sessão do usuário (req.user)
 * seguindo o padrão de Tenant Context
 */
export class CreatePresentialSaleDto {
  @IsString()
  customerName!: string;

  @IsString()
  customerPhone!: string;

  @IsOptional()
  @IsString()
  customerEmail?: string;

  /**
   * @deprecated Use payments instead
   */
  @IsOptional()
  @IsEnum(["DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "BRINDE"])
  paymentMethod?: "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "BRINDE";

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  payments?: PaymentItemDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

/**
 * DTO para cancelar pedido
 * PATCH /shop/admin/orders/:id/cancel
 */
export class CancelOrderDto {
  @IsString()
  reason!: string; // Motivo obrigatório
}

/**
 * DTO para confirmar pagamento presencial
 * PATCH /shop/admin/orders/:id/confirm-payment
 *
 * Usado no sistema de voucher onde cliente paga presencialmente na escola
 */
export class ConfirmPaymentDto {
  /**
   * @deprecated Use payments instead
   */
  @IsOptional()
  @IsEnum(["DINHEIRO", "PIX", "CARTAO_CREDITO", "CARTAO_DEBITO", "BRINDE"])
  paymentMethod?: "DINHEIRO" | "PIX" | "CARTAO_CREDITO" | "CARTAO_DEBITO" | "BRINDE";

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentItemDto)
  payments?: PaymentItemDto[];
}
