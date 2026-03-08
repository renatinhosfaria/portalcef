import { IsString, IsDateString, IsOptional, IsEnum } from "class-validator";

export class CriarCicloDto {
  @IsEnum(
    ["BERCARIO", "INFANTIL", "FUNDAMENTAL_I", "FUNDAMENTAL_II", "MEDIO"],
    {
      message:
        "Etapa deve ser BERCARIO, INFANTIL, FUNDAMENTAL_I, FUNDAMENTAL_II ou MEDIO",
    },
  )
  etapa!: string;

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

export class EditarCicloDto {
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

export class CicloResponseDto {
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
}
