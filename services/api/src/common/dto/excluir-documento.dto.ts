import { Transform } from "class-transformer";
import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class ExcluirDocumentoDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  motivo!: string;
}
