import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsInt,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

class InterestItemDto {
  @IsUUID()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateInterestRequestDto {
  @IsUUID()
  schoolId!: string;

  @IsUUID()
  unitId!: string;

  @IsString()
  @MinLength(3)
  customerName!: string;

  @IsString()
  @MinLength(10)
  customerPhone!: string;

  @IsEmail()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @MinLength(3)
  studentName!: string;

  @IsString()
  @IsOptional()
  studentClass?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InterestItemDto)
  items!: InterestItemDto[];
}
