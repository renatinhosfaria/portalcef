import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import type { FastifyRequest } from "fastify";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";

import { PlanejamentoObservabilidadeService } from "./planejamento-observabilidade.service";
import type {
  PlanejamentoObservabilidadeEventoEntrada,
  PlanejamentoObservabilidadeUsuario,
} from "./planejamento-observabilidade.types";

const ROTAS_PLANEJAMENTO = [
  "/api/plano-aula",
  "/api/plano-aula-periodo",
  "/api/plannings",
  "/api/quinzena-documents",
  "/api/prova",
  "/api/prova-ciclo",
  "/api/relatorio",
  "/api/semestre-relatorio",
];

const ROTA_OBSERVABILIDADE = "/api/planejamento-observabilidade";
const UUID_REGEX =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

type RequestPlanejamento = FastifyRequest & {
  correlationId?: string;
  user?: {
    userId?: string;
    role?: string;
    schoolId?: string | null;
    unitId?: string | null;
  };
};

type RespostaHttp = {
  statusCode?: unknown;
};

type ErroHttp = Error & {
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  getStatus?: () => unknown;
};

@Injectable()
export class PlanejamentoObservabilidadeInterceptor implements NestInterceptor {
  constructor(
    private readonly observabilidade: PlanejamentoObservabilidadeService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestPlanejamento>();
    const rota = this.sanitizarRota(req.url);

    if (!this.deveRegistrar(rota)) {
      return next.handle();
    }

    const inicio = Date.now();
    const slowMs = this.observabilidade.obterSlowMs();

    return next.handle().pipe(
      tap(() => {
        const resposta = http.getResponse<RespostaHttp>();
        const duracaoMs = Date.now() - inicio;
        const evento = this.criarEvento({
          req,
          rota,
          status: this.obterStatusResposta(resposta),
          duracaoMs,
          nivel: "info",
          evento: "api_chamada",
        });

        this.registrarSemPropagar(evento);

        if (duracaoMs >= slowMs) {
          this.registrarSemPropagar({
            ...evento,
            evento: "api_lenta",
            nivel: "warn",
          });
        }
      }),
      catchError((erro: unknown) => {
        const duracaoMs = Date.now() - inicio;
        const erroHttp = erro as ErroHttp;
        const evento = this.criarEvento({
          req,
          rota,
          status: this.obterStatusErro(erroHttp),
          duracaoMs,
          nivel: "error",
          evento: "api_chamada",
          erro: erroHttp,
        });

        this.registrarSemPropagar(evento);

        if (duracaoMs >= slowMs) {
          this.registrarSemPropagar({
            ...evento,
            evento: "api_lenta",
            nivel: "warn",
          });
        }

        return throwError(() => erro);
      }),
    );
  }

  private criarEvento({
    req,
    rota,
    status,
    duracaoMs,
    nivel,
    evento,
    erro,
  }: {
    req: RequestPlanejamento;
    rota: string;
    status: number;
    duracaoMs: number;
    nivel: "info" | "warn" | "error";
    evento: "api_chamada" | "api_lenta";
    erro?: ErroHttp;
  }): PlanejamentoObservabilidadeEventoEntrada {
    const registro: PlanejamentoObservabilidadeEventoEntrada = {
      origem: "api",
      evento,
      nivel,
      http: {
        metodo: req.method,
        rota,
        status,
        duracaoMs,
      },
    };

    if (req.correlationId) {
      registro.correlationId = req.correlationId;
    }

    const usuario = this.obterUsuario(req);
    if (usuario) {
      registro.usuario = usuario;
    }

    if (erro) {
      registro.erro = {
        codigo: this.obterCodigoErro(erro, status),
        mensagem: this.sanitizarMensagemErro(erro.message),
      };
    }

    return registro;
  }

  private registrarSemPropagar(
    evento: PlanejamentoObservabilidadeEventoEntrada,
  ): void {
    try {
      void this.observabilidade
        .registrarEvento(evento)
        .catch(() => undefined);
    } catch {
      return;
    }
  }

  private deveRegistrar(rota: string): boolean {
    if (this.correspondeAoPrefixo(rota, ROTA_OBSERVABILIDADE)) {
      return false;
    }

    return ROTAS_PLANEJAMENTO.some((prefixo) =>
      this.correspondeAoPrefixo(rota, prefixo),
    );
  }

  private correspondeAoPrefixo(rota: string, prefixo: string): boolean {
    return rota === prefixo || rota.startsWith(`${prefixo}/`);
  }

  private sanitizarRota(url: string): string {
    const semHash = url.split("#", 1)[0];
    const semQuery = semHash.split("?", 1)[0];

    return semQuery.replace(UUID_REGEX, ":id");
  }

  private obterUsuario(
    req: RequestPlanejamento,
  ): PlanejamentoObservabilidadeUsuario | undefined {
    const usuario = req.user;
    if (!usuario?.userId || !usuario.role) {
      return undefined;
    }

    return {
      id: usuario.userId,
      role: usuario.role,
      schoolId: usuario.schoolId,
      unitId: usuario.unitId,
    };
  }

  private obterStatusResposta(resposta: RespostaHttp): number {
    return this.numero(resposta.statusCode) ?? 200;
  }

  private obterStatusErro(erro: ErroHttp): number {
    return (
      this.numero(erro.getStatus?.()) ??
      this.numero(erro.status) ??
      this.numero(erro.statusCode) ??
      500
    );
  }

  private obterCodigoErro(erro: ErroHttp, status: number): string {
    return this.texto(erro.code) ?? this.texto(erro.name) ?? `HTTP_${status}`;
  }

  private sanitizarMensagemErro(mensagem: unknown): string {
    const texto = this.texto(mensagem) ?? "Erro desconhecido";

    return texto
      .replace(/(authorization\s*[:=]\s*Bearer\s+)[^\s"',}]+/gi, "$1***")
      .replace(this.regexCampoSensivel("token"), "$1$2***$2")
      .replace(this.regexCampoSensivel("password"), "$1$2***$2")
      .replace(this.regexCampoSensivel("senha"), "$1$2***$2")
      .replace(this.regexCampoSensivel("email"), "$1$2***$2")
      .replace(
        /(authorization\s*[:=]\s*)(?!Bearer\s+)(["']?)[^"',\s}]+(\2)/gi,
        "$1$2***$2",
      );
  }

  private regexCampoSensivel(campo: string): RegExp {
    return new RegExp(
      `(["']?${campo}["']?\\s*[:=]\\s*)(["']?)[^"',\\s}]+(\\2)`,
      "gi",
    );
  }

  private numero(valor: unknown): number | undefined {
    return typeof valor === "number" && Number.isFinite(valor)
      ? valor
      : undefined;
  }

  private texto(valor: unknown): string | undefined {
    return typeof valor === "string" ? valor : undefined;
  }
}
