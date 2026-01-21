import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { and, desc, eq, getDb, quinzenaDocuments } from "@essencia/db";

export interface CreateDocumentInput {
  quinzenaId: string;
  userId: string;
  unitId: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileSize?: number;
  fileType?: string;
}

export interface QuinzenaDocumentResult {
  id: string;
  quinzenaId: string;
  fileName: string;
  fileKey: string;
  fileUrl: string;
  fileSize: number | null;
  fileType: string | null;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
  };
}

@Injectable()
export class QuinzenaDocumentsService {
  private readonly logger = new Logger(QuinzenaDocumentsService.name);

  /**
   * Cria um novo documento para a quinzena
   */
  async create(input: CreateDocumentInput): Promise<QuinzenaDocumentResult> {
    const [document] = await getDb()
      .insert(quinzenaDocuments)
      .values({
        quinzenaId: input.quinzenaId,
        userId: input.userId,
        unitId: input.unitId,
        fileName: input.fileName,
        fileKey: input.fileKey,
        fileUrl: input.fileUrl,
        fileSize: input.fileSize,
        fileType: input.fileType,
      })
      .returning();

    this.logger.log(
      `Documento criado: ${document.id} para quinzena ${input.quinzenaId}`,
    );

    return {
      id: document.id,
      quinzenaId: document.quinzenaId,
      fileName: document.fileName,
      fileKey: document.fileKey,
      fileUrl: document.fileUrl,
      fileSize: document.fileSize,
      fileType: document.fileType,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  /**
   * Lista documentos de uma quinzena para uma unidade específica
   */
  async findByQuinzena(
    quinzenaId: string,
    unitId: string,
  ): Promise<QuinzenaDocumentResult[]> {
    const documents = await getDb()
      .select({
        id: quinzenaDocuments.id,
        quinzenaId: quinzenaDocuments.quinzenaId,
        fileName: quinzenaDocuments.fileName,
        fileKey: quinzenaDocuments.fileKey,
        fileUrl: quinzenaDocuments.fileUrl,
        fileSize: quinzenaDocuments.fileSize,
        fileType: quinzenaDocuments.fileType,
        createdAt: quinzenaDocuments.createdAt,
        updatedAt: quinzenaDocuments.updatedAt,
      })
      .from(quinzenaDocuments)
      .where(
        and(
          eq(quinzenaDocuments.quinzenaId, quinzenaId),
          eq(quinzenaDocuments.unitId, unitId),
        ),
      )
      .orderBy(desc(quinzenaDocuments.createdAt));

    return documents;
  }

  /**
   * Busca um documento pelo ID
   */
  async findById(id: string): Promise<QuinzenaDocumentResult | null> {
    const [document] = await getDb()
      .select({
        id: quinzenaDocuments.id,
        quinzenaId: quinzenaDocuments.quinzenaId,
        userId: quinzenaDocuments.userId,
        unitId: quinzenaDocuments.unitId,
        fileName: quinzenaDocuments.fileName,
        fileKey: quinzenaDocuments.fileKey,
        fileUrl: quinzenaDocuments.fileUrl,
        fileSize: quinzenaDocuments.fileSize,
        fileType: quinzenaDocuments.fileType,
        createdAt: quinzenaDocuments.createdAt,
        updatedAt: quinzenaDocuments.updatedAt,
      })
      .from(quinzenaDocuments)
      .where(eq(quinzenaDocuments.id, id));

    if (!document) {
      return null;
    }

    return document;
  }

  /**
   * Deleta um documento
   * Verifica se o usuário é o dono do documento
   */
  async delete(id: string, userId: string): Promise<void> {
    const document = await this.findById(id);

    if (!document) {
      throw new NotFoundException({
        code: "DOCUMENT_NOT_FOUND",
        message: "Documento não encontrado",
      });
    }

    // Verificar se o usuário é o dono do documento
    const [docWithUser] = await getDb()
      .select({ userId: quinzenaDocuments.userId })
      .from(quinzenaDocuments)
      .where(eq(quinzenaDocuments.id, id));

    if (docWithUser?.userId !== userId) {
      throw new NotFoundException({
        code: "DOCUMENT_NOT_FOUND",
        message: "Documento não encontrado",
      });
    }

    await getDb().delete(quinzenaDocuments).where(eq(quinzenaDocuments.id, id));

    this.logger.log(`Documento deletado: ${id}`);
  }
}
