import {
  IsString,
  IsDateString,
  IsOptional,
  IsEnum,
  IsInt,
  Max,
  Min,
} from "class-validator";

export class CriarSemestreRelatorioDto {
  @IsEnum(["BERCARIO", "INFANTIL"], {
    message: "Etapa deve ser BERCARIO ou INFANTIL",
  })
  etapa!: string;

  @IsInt()
  @Min(2000)
  anoLetivo!: number;

  @IsInt()
  @Min(1)
  @Max(2)
  semestre!: number;

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

export class EditarSemestreRelatorioDto {
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

export class SemestreRelatorioResponseDto {
  id!: string;
  unidadeId!: string;
  etapa!: string;
  anoLetivo!: number;
  semestre!: number;
  descricao?: string;
  dataInicio!: string;
  dataFim!: string;
  dataMaximaEntrega!: string;
  criadoPor?: string;
  criadoEm!: Date;
  atualizadoEm!: Date;
  relatoriosVinculados?: number;
}
