import { IsOptional, IsString } from "class-validator";

export class EditarPeriodoDto {
  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  dataInicio?: string;

  @IsOptional()
  @IsString()
  dataFim?: string;

  @IsOptional()
  @IsString()
  dataMaximaEntrega?: string;
}
