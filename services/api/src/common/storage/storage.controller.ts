import { MultipartFile } from "@fastify/multipart";
import {
  BadRequestException,
  Controller,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { StorageService } from "./storage.service";

interface FastifyMultipartRequest extends FastifyRequest {
  isMultipart: () => boolean;
  file: () => Promise<MultipartFile>;
}

@Controller("storage")
@UseGuards(AuthGuard, RolesGuard)
export class StorageController {
  private readonly logger = new Logger(StorageController.name);

  constructor(private readonly storageService: StorageService) {}

  @Post("upload")
  async upload(@Req() req: FastifyMultipartRequest) {
    if (!req.isMultipart()) {
      throw new BadRequestException({
        code: "INVALID_REQUEST",
        message: "Request deve ser multipart/form-data",
      });
    }

    const file = await req.file();

    if (!file) {
      throw new BadRequestException({
        code: "NO_FILE",
        message: "Nenhum arquivo enviado",
      });
    }

    try {
      const result = await this.storageService.uploadFile(file);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error(
        `Erro ao fazer upload: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException({
        code: "UPLOAD_FAILED",
        message:
          "Erro ao fazer upload do arquivo. Verifique a configuração do MinIO.",
      });
    }
  }
}
