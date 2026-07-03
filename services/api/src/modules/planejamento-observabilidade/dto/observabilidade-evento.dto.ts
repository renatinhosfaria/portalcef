import { z } from "zod";

const TAMANHO_URL = 2000;
const TAMANHO_TITULO = 200;
const TAMANHO_NOME = 255;
const TAMANHO_MENSAGEM = 500;
const TAMANHO_STACK = 1000;
const TAMANHO_ID = 120;
const TAMANHO_TEXTO_CURTO = 120;
const TAMANHO_DETALHES_TEXTO = 500;
const LIMITE_DETALHES_PROFUNDIDADE = 3;
const LIMITE_DETALHES_CHAVES = 20;
const LIMITE_DETALHES_ARRAY = 20;

const chavesDetalhesPermitidas = new Set([
  "acao",
  "duracaoMs",
  "duracaoTotalMs",
  "etapa",
  "fallback",
  "limiteMs",
  "lento",
  "modulo",
  "navegador",
  "online",
  "origemAcao",
  "quantidade",
  "resultado",
  "sistema",
  "status",
  "tamanhoBytes",
  "tentativa",
  "tipo",
  "visibilidade",
]);

const eventoSchema = z.enum([
  "pagina_aberta",
  "api_chamada",
  "api_lenta",
  "arquivo_acao",
  "erro_navegador",
  "upload_resultado",
  "sharepoint_word",
]);

const nivelSchema = z.enum(["info", "warn", "error"]);

const textoCurtoSchema = z.string().trim().max(TAMANHO_TEXTO_CURTO);
const idSchema = z.string().trim().max(TAMANHO_ID);

const httpSchema = z.object({
  metodo: textoCurtoSchema.optional(),
  rota: z.string().trim().max(TAMANHO_URL).optional(),
  status: z.number().int().min(100).max(599).optional(),
  duracaoMs: z.number().finite().min(0).optional(),
});

const paginaSchema = z.object({
  url: z.string().trim().max(TAMANHO_URL).optional(),
  titulo: z.string().trim().max(TAMANHO_TITULO).optional(),
});

const arquivoSchema = z.object({
  planoId: idSchema.nullable().optional(),
  provaId: idSchema.nullable().optional(),
  relatorioId: idSchema.nullable().optional(),
  documentoId: idSchema.nullable().optional(),
  nome: z.string().trim().max(TAMANHO_NOME).nullable().optional(),
  tipo: textoCurtoSchema.nullable().optional(),
  tamanhoBytes: z.number().finite().min(0).nullable().optional(),
});

const erroSchema = z.object({
  codigo: textoCurtoSchema.nullable().optional(),
  mensagem: z.string().trim().max(TAMANHO_MENSAGEM).nullable().optional(),
  stackResumo: z.string().trim().max(TAMANHO_STACK).nullable().optional(),
});

function ehObjetoSimples(valor: unknown): valor is Record<string, unknown> {
  if (
    typeof valor !== "object" ||
    valor === null ||
    Array.isArray(valor)
  ) {
    return false;
  }

  const prototipo = Object.getPrototypeOf(valor);

  return prototipo === Object.prototype || prototipo === null;
}

function adicionarErroDetalhes(
  ctx: z.RefinementCtx,
  caminho: Array<string | number>,
  mensagem: string,
) {
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: caminho,
    message: mensagem,
  });
}

function validarValorDetalhes(
  valor: unknown,
  ctx: z.RefinementCtx,
  caminho: Array<string | number>,
  profundidade: number,
): void {
  if (profundidade > LIMITE_DETALHES_PROFUNDIDADE) {
    adicionarErroDetalhes(
      ctx,
      caminho,
      "detalhes excede a profundidade permitida",
    );
    return;
  }

  if (valor === null || typeof valor === "boolean") {
    return;
  }

  if (typeof valor === "string") {
    if (valor.length > TAMANHO_DETALHES_TEXTO) {
      adicionarErroDetalhes(
        ctx,
        caminho,
        "detalhes possui texto acima do limite permitido",
      );
    }

    return;
  }

  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) {
      adicionarErroDetalhes(
        ctx,
        caminho,
        "detalhes possui numero invalido",
      );
    }

    return;
  }

  if (Array.isArray(valor)) {
    if (valor.length > LIMITE_DETALHES_ARRAY) {
      adicionarErroDetalhes(
        ctx,
        caminho,
        "detalhes possui lista acima do limite permitido",
      );
    }

    valor
      .slice(0, LIMITE_DETALHES_ARRAY)
      .forEach((item, indice) =>
        validarValorDetalhes(
          item,
          ctx,
          [...caminho, indice],
          profundidade + 1,
        ),
      );
    return;
  }

  if (ehObjetoSimples(valor)) {
    const chaves = Object.keys(valor);

    if (chaves.length > LIMITE_DETALHES_CHAVES) {
      adicionarErroDetalhes(
        ctx,
        caminho,
        "detalhes possui objeto acima do limite permitido",
      );
    }

    chaves.slice(0, LIMITE_DETALHES_CHAVES).forEach((chave) => {
      const caminhoAtual = [...caminho, chave];

      if (!chavesDetalhesPermitidas.has(chave)) {
        adicionarErroDetalhes(
          ctx,
          caminhoAtual,
          "detalhes possui chave nao permitida",
        );
      }

      validarValorDetalhes(
        valor[chave],
        ctx,
        caminhoAtual,
        profundidade + 1,
      );
    });
    return;
  }

  adicionarErroDetalhes(
    ctx,
    caminho,
    "detalhes possui tipo nao permitido",
  );
}

const detalhesSchema = z
  .custom<Record<string, unknown>>((valor) => ehObjetoSimples(valor), {
    message: "detalhes deve ser um objeto simples",
  })
  .superRefine((detalhes, ctx) => {
    validarValorDetalhes(detalhes, ctx, [], 0);
  });

const observabilidadeEventoSchema = z.object({
  timestamp: z.string().datetime().optional(),
  ambiente: textoCurtoSchema.optional(),
  origem: z.literal("browser"),
  evento: eventoSchema,
  nivel: nivelSchema.optional(),
  correlationId: idSchema.nullable().optional(),
  sessaoObservabilidadeId: idSchema.nullable().optional(),
  requestId: idSchema.nullable().optional(),
  http: httpSchema.optional(),
  pagina: paginaSchema.optional(),
  arquivo: arquivoSchema.optional(),
  erro: erroSchema.optional(),
  detalhes: detalhesSchema.nullable().optional(),
});

export const observabilidadeEventosSchema = z.object({
  eventos: z
    .array(observabilidadeEventoSchema)
    .min(1, "Informe ao menos um evento")
    .max(25, "Limite de 25 eventos por lote"),
});

export type ObservabilidadeEventosDto = z.infer<
  typeof observabilidadeEventosSchema
>;
