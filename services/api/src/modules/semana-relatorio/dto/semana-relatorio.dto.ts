import { IsString, IsDateString, IsOptional, IsEnum, IsInt, Min } from "class-validator";

export class CriarSemanaRelatorioDto {
  @IsEnum(["BERCARIO", "INFANTIL"], {
    message: "Etapa deve ser BERCARIO ou INFANTIL",
  })
  etapa!: string;

  @IsInt()
  @Min(1)
  numero!: number;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsDateString()
  dataInicio!: string;

  @IsDateString()
  dataFim!: string;

  @IsDateString()
  dataMaximaEntrega!: string;
}

export class EditarSemanaRelatorioDto {
  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsDateString()
  dataMaximaEntrega?: string;
}

export class SemanaRelatorioResponseDto {
  id!: string;
  unidadeId!: string;
  etapa!: string;
  numero!: number;
  descricao?: string;
  dataInicio!: string;
  dataFim!: string;
  dataMaximaEntrega!: string;
  criadoPor?: string;
  criadoEm!: Date;
  atualizadoEm!: Date;
  relatoriosVinculados?: number;
}
