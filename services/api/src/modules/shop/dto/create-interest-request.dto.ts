import {
  IsString,
  IsEmail,
  IsOptional,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  MinLength,
} from "class-validator";
import { Type } from "class-transformer";

class InterestItemDto {
  @IsString()
  variantId!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateInterestRequestDto {
  @IsString()
  schoolId!: string;

  @IsString()
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
  @ValidateNested({ each: true })
  @Type(() => InterestItemDto)
  items!: InterestItemDto[];
}
