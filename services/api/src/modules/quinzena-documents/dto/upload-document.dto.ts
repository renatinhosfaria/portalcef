import { IsNotEmpty, IsString } from "class-validator";

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty({ message: "quinzenaId é obrigatório" })
  quinzenaId!: string;
}
