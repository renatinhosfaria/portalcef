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
 * DTO para salvar rascunho de planejamento
 * POST /plannings/draft
 */
export class SaveDraftDto {
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
  objetivos?: string;

  @IsOptional()
  @IsString({ message: "Habilidades deve ser uma string" })
  habilidades?: string;

  @IsOptional()
  @IsString({ message: "Conteúdos deve ser uma string" })
  conteudos?: string;

  @IsOptional()
  @IsString({ message: "Metodologia deve ser uma string" })
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

  // Anexos virá como array de objetos de arquivos
  @IsOptional()
  anexos?: FileAttachment[];
}
