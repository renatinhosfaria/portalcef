import { IsString, IsDateString, IsOptional, IsUUID, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CriarPeriodoDto {
  @ApiProperty({ example: 'INFANTIL' })
  @IsString()
  etapa: string;

  @ApiPropertyOptional({ example: 'Tema: Meio Ambiente' })
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiProperty({ example: '2026-03-01' })
  @IsDateString()
  dataInicio: string;

  @ApiProperty({ example: '2026-03-15' })
  @IsDateString()
  dataFim: string;

  @ApiProperty({ example: '2026-03-13' })
  @IsDateString()
  dataMaximaEntrega: string;
}

export class EditarPeriodoDto {
  @ApiPropertyOptional({ example: 'Tema: Sustentabilidade' })
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsDateString()
  dataInicio?: string;

  @ApiPropertyOptional({ example: '2026-03-15' })
  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @ApiPropertyOptional({ example: '2026-03-13' })
  @IsOptional()
  @IsDateString()
  dataMaximaEntrega?: string;
}

export class PeriodoResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  unidadeId: string;

  @ApiProperty()
  etapa: string;

  @ApiProperty()
  numero: number;

  @ApiProperty({ required: false })
  descricao?: string;

  @ApiProperty()
  dataInicio: string;

  @ApiProperty()
  dataFim: string;

  @ApiProperty()
  dataMaximaEntrega: string;

  @ApiProperty()
  criadoPor?: string;

  @ApiProperty()
  criadoEm: Date;

  @ApiProperty()
  atualizadoEm: Date;

  @ApiProperty({ required: false })
  planosVinculados?: number;
}
