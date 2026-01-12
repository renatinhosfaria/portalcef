import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export class UpdateSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  maxInstallments?: number;

  @IsOptional()
  @IsBoolean()
  isShopEnabled?: boolean;

  @IsOptional()
  @IsString()
  pickupInstructions?: string | null;
}
