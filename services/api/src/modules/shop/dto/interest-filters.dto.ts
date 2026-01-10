import { IsOptional, IsString, IsInt, Min, IsIn } from "class-validator";
import { Type } from "class-transformer";

export class InterestFiltersDto {
  @IsOptional()
  @IsIn(["PENDENTE", "CONTATADO", "TODOS"])
  status?: "PENDENTE" | "CONTATADO" | "TODOS" = "TODOS";

  @IsOptional()
  @IsString()
  search?: string = "";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
