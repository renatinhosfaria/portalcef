import { IsOptional, IsString, MinLength } from "class-validator";

/**
 * Representação de um arquivo anexado ao planejamento
 */
interface FileAttachment {
  url: string;
  key: string;
  name: string;
}

/**
 * DTO para submeter planejamento para coordenação
 * POST /plannings/submit
 */
export class SubmitPlanningDto {
  @IsString({ message: "Turma deve ser uma string" })
  @MinLength(1, { message: "Turma é obrigatória" })
  turma!: string;

  @IsString({ message: "Quinzena deve ser uma string" })
  @MinLength(1, { message: "Quinzena é obrigatória" })
  quinzena!: string;

  @IsOptional()
  @IsString({ message: "Matéria deve ser uma string" })
  materia?: string;

  @IsOptional()
  @IsString({ message: "Tema deve ser uma string" })
  tema?: string;

  @IsOptional()
  @IsString({ message: "Objetivos deve ser uma string" })
  @MinLength(20, {
    message: "Objetivos devem ter pelo menos 20 caracteres",
  })
  objetivos?: string;

  @IsOptional()
  @IsString({ message: "Habilidades deve ser uma string" })
  habilidades?: string;

  @IsOptional()
  @IsString({ message: "Conteúdos deve ser uma string" })
  conteudos?: string;

  @IsOptional()
  @IsString({ message: "Metodologia deve ser uma string" })
  @MinLength(30, {
    message: "Metodologia deve ter pelo menos 30 caracteres",
  })
  metodologia?: string;

  @IsOptional()
  @IsString({ message: "Recursos deve ser uma string" })
  recursos?: string;

  @IsOptional()
  @IsString({ message: "Avaliação deve ser uma string" })
  avaliacao?: string;

  @IsOptional()
  @IsString({ message: "Reforço deve ser uma string" })
  reforco?: string;

  @IsOptional()
  anexos?: FileAttachment[];
}
