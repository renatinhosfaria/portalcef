import { Inject, Injectable, Optional } from "@nestjs/common";
import { appendFile, mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import type {
  PlanejamentoObservabilidadeArquivo,
  PlanejamentoObservabilidadeErro,
  PlanejamentoObservabilidadeEventoEntrada,
  PlanejamentoObservabilidadeEventoNormalizado,
  PlanejamentoObservabilidadeHttp,
  PlanejamentoObservabilidadePagina,
  PlanejamentoObservabilidadeServiceConfig,
  PlanejamentoObservabilidadeUsuario,
} from "./planejamento-observabilidade.types";

const DIRETORIO_PADRAO = "/var/log/essencia/planejamento";
const AMBIENTE_PADRAO = process.env.NODE_ENV ?? "development";
const SLOW_MS_PADRAO = 2000;
const RETENCAO_DIAS_PADRAO = 30;
const LIMITE_MENSAGEM_ERRO = 500;
const LIMITE_STACK_ERRO = 1000;
const UUID_REGEX =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

const CHAVES_PROIBIDAS = new Set([
  "cookie",
  "authorization",
  "token",
  "password",
  "senha",
  "body",
  "payload",
  "conteudo",
  "html",
  "headers",
]);

export const PLANEJAMENTO_OBSERVABILIDADE_CONFIG = Symbol(
  "PLANEJAMENTO_OBSERVABILIDADE_CONFIG",
);

@Injectable()
export class PlanejamentoObservabilidadeService {
  private readonly diretorio: string;
  private readonly ambiente: string;
  private readonly slowMs: number;
  private readonly retencaoDias: number;
  private readonly agora: () => Date;

  constructor(
    @Optional()
    @Inject(PLANEJAMENTO_OBSERVABILIDADE_CONFIG)
    config: PlanejamentoObservabilidadeServiceConfig = {},
  ) {
    this.diretorio = config.diretorio ?? DIRETORIO_PADRAO;
    this.ambiente = config.ambiente ?? AMBIENTE_PADRAO;
    this.slowMs = this.normalizarSlowMs(config.slowMs);
    this.retencaoDias = config.retencaoDias ?? RETENCAO_DIAS_PADRAO;
    this.agora = config.agora ?? (() => new Date());
  }

  normalizarEvento(
    evento: PlanejamentoObservabilidadeEventoEntrada,
  ): PlanejamentoObservabilidadeEventoNormalizado {
    const sanitizado = this.sanitizarValor(
      evento,
    ) as PlanejamentoObservabilidadeEventoEntrada;
    const agora = this.agora();

    const normalizado: PlanejamentoObservabilidadeEventoNormalizado = {
      timestamp: this.normalizarTimestamp(sanitizado.timestamp, agora),
      ambiente: this.texto(sanitizado.ambiente) ?? this.ambiente,
      app: "planejamento",
      origem: sanitizado.origem,
      evento: sanitizado.evento,
      nivel: sanitizado.nivel ?? "info",
    };

    this.definirTextoOuNull(
      normalizado,
      "correlationId",
      sanitizado.correlationId,
    );
    this.definirTextoOuNull(
      normalizado,
      "sessaoObservabilidadeId",
      sanitizado.sessaoObservabilidadeId,
    );
    this.definirTextoOuNull(normalizado, "requestId", sanitizado.requestId);

    const usuario = this.normalizarUsuario(sanitizado.usuario);
    if (usuario) {
      normalizado.usuario = usuario;
    }

    const http = this.normalizarHttp(sanitizado.http);
    if (http) {
      normalizado.http = http;
    }

    const pagina = this.normalizarPagina(sanitizado.pagina);
    if (pagina) {
      normalizado.pagina = pagina;
    }

    const arquivo = this.normalizarArquivo(sanitizado.arquivo);
    if (arquivo) {
      normalizado.arquivo = arquivo;
    }

    const erro = this.normalizarErro(sanitizado.erro);
    if (erro) {
      normalizado.erro = erro;
    }

    const detalhes = this.normalizarDetalhes(sanitizado.detalhes);
    if (detalhes !== undefined) {
      normalizado.detalhes = detalhes;
    }

    return normalizado;
  }

  async registrarEvento(
    evento: PlanejamentoObservabilidadeEventoEntrada,
  ): Promise<void> {
    try {
      const normalizado = this.normalizarEvento(evento);
      const dataArquivo = new Date(normalizado.timestamp);
      const arquivo = this.obterArquivoDoDia(
        Number.isNaN(dataArquivo.getTime()) ? this.agora() : dataArquivo,
      );

      await mkdir(this.diretorio, { recursive: true });
      await appendFile(arquivo, `${JSON.stringify(normalizado)}\n`, "utf8");
    } catch {
      return;
    }
  }

  async limparAntigos(): Promise<void> {
    try {
      await mkdir(this.diretorio, { recursive: true });
      const arquivos = await readdir(this.diretorio);
      const dataLimite = this.formatarDataArquivo(
        this.subtrairDias(this.agora(), this.retencaoDias),
      );

      await Promise.all(
        arquivos.map(async (arquivo) => {
          const resultado = /^planejamento-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(
            arquivo,
          );

          if (!resultado || resultado[1] >= dataLimite) {
            return;
          }

          await rm(join(this.diretorio, arquivo), { force: true });
        }),
      );
    } catch {
      return;
    }
  }

  obterArquivoDoDia(data = new Date()): string {
    return join(
      this.diretorio,
      `planejamento-${this.formatarDataArquivo(data)}.jsonl`,
    );
  }

  obterSlowMs(): number {
    return this.slowMs;
  }

  private normalizarUsuario(
    usuario: PlanejamentoObservabilidadeEventoEntrada["usuario"],
  ): PlanejamentoObservabilidadeUsuario | undefined {
    if (!this.ehObjetoSimples(usuario)) {
      return undefined;
    }

    const normalizado: Partial<PlanejamentoObservabilidadeUsuario> = {};
    this.definirTexto(normalizado, "id", usuario.id);
    this.definirTextoOuNull(normalizado, "nome", usuario.nome);
    this.definirTexto(normalizado, "role", usuario.role);
    this.definirTextoOuNull(normalizado, "schoolId", usuario.schoolId);
    this.definirTextoOuNull(normalizado, "unitId", usuario.unitId);

    return this.comCampos(normalizado)
      ? (normalizado as PlanejamentoObservabilidadeUsuario)
      : undefined;
  }

  private normalizarHttp(
    http: PlanejamentoObservabilidadeEventoEntrada["http"],
  ): PlanejamentoObservabilidadeHttp | undefined {
    if (!this.ehObjetoSimples(http)) {
      return undefined;
    }

    const normalizado: PlanejamentoObservabilidadeHttp = {};
    this.definirTexto(normalizado, "metodo", http.metodo);
    this.definirTexto(
      normalizado,
      "rota",
      this.sanitizarRota(this.texto(http.rota)),
    );
    this.definirNumero(normalizado, "status", http.status);
    this.definirNumero(normalizado, "duracaoMs", http.duracaoMs);

    return this.comCampos(normalizado) ? normalizado : undefined;
  }

  private normalizarPagina(
    pagina: PlanejamentoObservabilidadeEventoEntrada["pagina"],
  ): PlanejamentoObservabilidadePagina | undefined {
    if (!this.ehObjetoSimples(pagina)) {
      return undefined;
    }

    const normalizado: PlanejamentoObservabilidadePagina = {};
    this.definirTexto(
      normalizado,
      "url",
      this.sanitizarRota(this.texto(pagina.url)),
    );
    this.definirTexto(normalizado, "titulo", pagina.titulo);

    return this.comCampos(normalizado) ? normalizado : undefined;
  }

  private normalizarArquivo(
    arquivo: PlanejamentoObservabilidadeEventoEntrada["arquivo"],
  ): PlanejamentoObservabilidadeArquivo | undefined {
    if (!this.ehObjetoSimples(arquivo)) {
      return undefined;
    }

    const normalizado: PlanejamentoObservabilidadeArquivo = {};
    this.definirTextoOuNull(normalizado, "planoId", arquivo.planoId);
    this.definirTextoOuNull(normalizado, "provaId", arquivo.provaId);
    this.definirTextoOuNull(normalizado, "documentoId", arquivo.documentoId);
    this.definirTextoOuNull(normalizado, "nome", arquivo.nome);
    this.definirTextoOuNull(normalizado, "tipo", arquivo.tipo);
    this.definirNumeroOuNull(
      normalizado,
      "tamanhoBytes",
      arquivo.tamanhoBytes,
    );

    return this.comCampos(normalizado) ? normalizado : undefined;
  }

  private normalizarErro(
    erro: PlanejamentoObservabilidadeEventoEntrada["erro"],
  ): PlanejamentoObservabilidadeErro | undefined {
    if (!this.ehObjetoSimples(erro)) {
      return undefined;
    }

    const normalizado: PlanejamentoObservabilidadeErro = {};
    this.definirTextoOuNull(normalizado, "codigo", erro.codigo);
    this.definirTextoOuNull(
      normalizado,
      "mensagem",
      this.truncar(this.textoOuNull(erro.mensagem), LIMITE_MENSAGEM_ERRO),
    );
    this.definirTextoOuNull(
      normalizado,
      "stackResumo",
      this.truncar(this.textoOuNull(erro.stackResumo), LIMITE_STACK_ERRO),
    );

    return this.comCampos(normalizado) ? normalizado : undefined;
  }

  private normalizarDetalhes(
    detalhes: PlanejamentoObservabilidadeEventoEntrada["detalhes"],
  ): Record<string, unknown> | null | undefined {
    if (detalhes === null) {
      return null;
    }

    if (!this.ehObjetoSimples(detalhes)) {
      return undefined;
    }

    return this.sanitizarValor(detalhes) as Record<string, unknown>;
  }

  private sanitizarValor(valor: unknown): unknown {
    if (Array.isArray(valor)) {
      return valor
        .map((item) => this.sanitizarValor(item))
        .filter((item) => item !== undefined);
    }

    if (valor instanceof Date) {
      return valor.toISOString();
    }

    if (!this.ehObjetoSimples(valor)) {
      return valor;
    }

    return Object.fromEntries(
      Object.entries(valor)
        .filter(([chave]) => !CHAVES_PROIBIDAS.has(chave.toLowerCase()))
        .map(([chave, item]) => [chave, this.sanitizarValor(item)])
        .filter(([, item]) => item !== undefined),
    );
  }

  private sanitizarRota(valor: string | undefined): string | undefined {
    if (!valor) {
      return undefined;
    }

    const semHash = valor.split("#", 1)[0];
    const semQuery = semHash.split("?", 1)[0];

    return semQuery.replace(UUID_REGEX, ":id");
  }

  private normalizarTimestamp(valor: unknown, agora: Date): string {
    const texto = this.texto(valor);
    if (!texto) {
      return agora.toISOString();
    }

    const data = new Date(texto);
    if (Number.isNaN(data.getTime()) || data.getTime() > agora.getTime()) {
      return agora.toISOString();
    }

    return data.toISOString();
  }

  private truncar(
    valor: string | null | undefined,
    limite: number,
  ): string | null | undefined {
    if (typeof valor !== "string") {
      return valor;
    }

    return valor.slice(0, limite);
  }

  private texto(valor: unknown): string | undefined {
    return typeof valor === "string" ? valor : undefined;
  }

  private textoOuNull(valor: unknown): string | null | undefined {
    if (valor === null) {
      return null;
    }

    return this.texto(valor);
  }

  private numero(valor: unknown): number | undefined {
    return typeof valor === "number" && Number.isFinite(valor)
      ? valor
      : undefined;
  }

  private normalizarSlowMs(valor: unknown): number {
    const numero = this.numero(valor);

    return numero && numero > 0 ? numero : SLOW_MS_PADRAO;
  }

  private numeroOuNull(valor: unknown): number | null | undefined {
    if (valor === null) {
      return null;
    }

    return this.numero(valor);
  }

  private definirTexto<T extends Record<string, unknown>>(
    destino: T,
    chave: keyof T,
    valor: unknown,
  ): void {
    const texto = this.texto(valor);
    if (texto !== undefined) {
      destino[chave] = texto as T[keyof T];
    }
  }

  private definirTextoOuNull<T extends Record<string, unknown>>(
    destino: T,
    chave: keyof T,
    valor: unknown,
  ): void {
    const texto = this.textoOuNull(valor);
    if (texto !== undefined) {
      destino[chave] = texto as T[keyof T];
    }
  }

  private definirNumero<T extends Record<string, unknown>>(
    destino: T,
    chave: keyof T,
    valor: unknown,
  ): void {
    const numero = this.numero(valor);
    if (numero !== undefined) {
      destino[chave] = numero as T[keyof T];
    }
  }

  private definirNumeroOuNull<T extends Record<string, unknown>>(
    destino: T,
    chave: keyof T,
    valor: unknown,
  ): void {
    const numero = this.numeroOuNull(valor);
    if (numero !== undefined) {
      destino[chave] = numero as T[keyof T];
    }
  }

  private ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
    return (
      typeof valor === "object" &&
      valor !== null &&
      !Array.isArray(valor) &&
      !(valor instanceof Date)
    );
  }

  private comCampos(valor: Record<string, unknown>): boolean {
    return Object.keys(valor).length > 0;
  }

  private subtrairDias(data: Date, dias: number): Date {
    const resultado = new Date(data);
    resultado.setDate(resultado.getDate() - dias);
    return resultado;
  }

  private formatarDataArquivo(data: Date): string {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, "0");
    const dia = String(data.getDate()).padStart(2, "0");

    return `${ano}-${mes}-${dia}`;
  }
}
