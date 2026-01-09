import { IsString, MinLength, MaxLength } from "class-validator";

/**
 * DTO para solicitar ajustes em planejamento
 * POST /plannings/:id/request-changes
 */
export class RequestChangesDto {
  @IsString({ message: "Comentário deve ser uma string" })
  @MinLength(10, { message: "Comentário deve ter pelo menos 10 caracteres" })
  @MaxLength(2000, {
    message: "Comentário deve ter no máximo 2000 caracteres",
  })
  comment!: string;
}
