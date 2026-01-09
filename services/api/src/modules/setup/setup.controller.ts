import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from "@nestjs/common";
import { z } from "zod";

import { SetupService } from "./setup.service";

const initSetupSchema = z.object({
  schoolName: z.string().min(1, "Nome da escola é obrigatório"),
  schoolCode: z.string().min(1, "Código da escola é obrigatório"),
  unitName: z.string().min(1, "Nome da unidade é obrigatório"),
  unitCode: z.string().min(1, "Código da unidade é obrigatório"),
  unitAddress: z.string().min(1, "Endereço da unidade é obrigatório"),
  masterEmail: z.string().email("Email inválido"),
  masterPassword: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  masterName: z.string().min(1, "Nome do usuário master é obrigatório"),
});

/**
 * Controller para setup inicial do sistema
 * Endpoints públicos (sem autenticação) para bootstrapping
 */
@Controller("setup")
export class SetupController {
  constructor(private setupService: SetupService) {}

  /**
   * Verifica se o sistema já foi inicializado
   */
  @Get("status")
  async getStatus() {
    const initialized = await this.setupService.isInitialized();
    return {
      success: true,
      data: {
        initialized,
        message: initialized
          ? "Sistema já foi inicializado"
          : "Sistema pronto para inicialização",
      },
    };
  }

  /**
   * Inicializa o sistema com dados básicos: escola, unidade e usuário master
   * Só funciona se o banco estiver vazio
   */
  @Post("init")
  @HttpCode(HttpStatus.CREATED)
  async initialize(@Body() body: unknown) {
    // Validar dados
    const result = initSetupSchema.safeParse(body);
    if (!result.success) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados inválidos",
          details: result.error.flatten(),
        },
      };
    }

    try {
      const data = await this.setupService.initialize(result.data);
      return {
        success: true,
        data,
        message: "Sistema inicializado com sucesso",
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "SETUP_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Erro ao inicializar sistema",
        },
      };
    }
  }

  /**
   * Reseta o sistema (apenas em desenvolvimento)
   */
  @Post("reset")
  @HttpCode(HttpStatus.OK)
  async reset() {
    try {
      await this.setupService.reset();
      return {
        success: true,
        message: "Sistema resetado com sucesso",
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "RESET_ERROR",
          message:
            error instanceof Error ? error.message : "Erro ao resetar sistema",
        },
      };
    }
  }
}
