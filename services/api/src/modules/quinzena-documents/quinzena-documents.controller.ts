import { MultipartFile } from "@fastify/multipart";
import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Logger,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { FastifyRequest } from "fastify";
import { Roles } from "../../common/decorators/roles.decorator";
import { AuthGuard } from "../../common/guards/auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { StorageService } from "../../common/storage/storage.service";
import { QuinzenaDocumentsService } from "./quinzena-documents.service";

interface FastifyMultipartRequest extends FastifyRequest {
  isMultipart: () => boolean;
  file: () => Promise<MultipartFile>;
  user: {
    userId: string;
    unitId: string | null;
    schoolId: string | null;
    role: string;
  };
}

interface UserContext {
  userId: string;
  unitId: string | null;
  schoolId: string | null;
  role: string;
}

// Roles que podem fazer upload de documentos
const UPLOAD_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "analista_pedagogico",
  "professora",
  "auxiliar_sala",
];

@Controller("quinzena-documents")
@UseGuards(AuthGuard, RolesGuard)
export class QuinzenaDocumentsController {
  private readonly logger = new Logger(QuinzenaDocumentsController.name);

  constructor(
    private readonly documentsService: QuinzenaDocumentsService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Upload de documento para uma quinzena
   * POST /quinzena-documents/upload
   * Body (multipart/form-data): file, quinzenaId
   */
  @Post("upload")
  @Roles(...UPLOAD_ROLES)
  async upload(@Req() req: FastifyMultipartRequest) {
    if (!req.isMultipart()) {
      throw new BadRequestException({
        code: "INVALID_REQUEST",
        message: "Request deve ser multipart/form-data",
      });
    }

    const user = req.user;

    if (!user.unitId) {
      throw new BadRequestException({
        code: "NO_UNIT",
        message: "Usuário não está associado a uma unidade",
      });
    }

    // Parse multipart data
    const data = await req.file();

    if (!data) {
      throw new BadRequestException({
        code: "NO_FILE",
        message: "Nenhum arquivo enviado",
      });
    }

    // Get quinzenaId from fields
    const fields = data.fields as Record<
      string,
      { value?: string } | undefined
    >;
    const quinzenaId = fields?.quinzenaId?.value;

    if (!quinzenaId) {
      throw new BadRequestException({
        code: "NO_QUINZENA_ID",
        message: "quinzenaId é obrigatório",
      });
    }

    // Validar tipo de arquivo
    const allowedMimeTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/png",
      "image/jpeg",
      "image/jpg",
    ];

    if (!allowedMimeTypes.includes(data.mimetype)) {
      throw new BadRequestException({
        code: "INVALID_FILE_TYPE",
        message:
          "Tipo de arquivo não permitido. Use PDF, DOC, DOCX, PNG ou JPG",
      });
    }

    // Validar tamanho (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    const buffer = await data.toBuffer();
    if (buffer.length > MAX_SIZE) {
      throw new BadRequestException({
        code: "FILE_TOO_LARGE",
        message: "Arquivo muito grande. Tamanho máximo: 10MB",
      });
    }

    try {
      // Upload para MinIO
      const uploadResult = await this.storageService.uploadFile(data);

      // Salvar no banco
      const document = await this.documentsService.create({
        quinzenaId,
        userId: user.userId,
        unitId: user.unitId,
        fileName: uploadResult.name,
        fileKey: uploadResult.key,
        fileUrl: uploadResult.url,
        fileSize: buffer.length,
        fileType: data.mimetype,
      });

      return {
        success: true,
        data: document,
      };
    } catch (error) {
      this.logger.error(
        `Erro ao fazer upload: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException({
        code: "UPLOAD_FAILED",
        message: "Erro ao fazer upload do arquivo",
      });
    }
  }

  /**
   * Lista documentos de uma quinzena
   * GET /quinzena-documents/:quinzenaId
   */
  @Get(":quinzenaId")
  @Roles(...UPLOAD_ROLES)
  async findByQuinzena(
    @Param("quinzenaId") quinzenaId: string,
    @Req() req: { user: UserContext },
  ) {
    const user = req.user;

    if (!user.unitId) {
      throw new BadRequestException({
        code: "NO_UNIT",
        message: "Usuário não está associado a uma unidade",
      });
    }

    const documents = await this.documentsService.findByQuinzena(
      quinzenaId,
      user.unitId,
    );

    return {
      success: true,
      data: documents,
    };
  }

  /**
   * Deleta um documento
   * DELETE /quinzena-documents/:id
   */
  @Delete(":id")
  @Roles(...UPLOAD_ROLES)
  async delete(@Param("id") id: string, @Req() req: { user: UserContext }) {
    await this.documentsService.delete(id, req.user.userId);

    return {
      success: true,
      message: "Documento excluído com sucesso",
    };
  }
}
