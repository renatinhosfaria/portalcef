import { z } from "zod";

const itemOrdenadoSchema = z.object({
  id: z.string().uuid().optional(),
  ordem: z.coerce.number().int().min(1),
});

export const criarCategoriaSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  ordem: z.coerce.number().int().min(0).optional(),
});
export type CriarCategoriaDto = z.infer<typeof criarCategoriaSchema>;

export const atualizarCategoriaSchema = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  ativo: z.boolean().optional(),
  ordem: z.coerce.number().int().min(0).optional(),
});
export type AtualizarCategoriaDto = z.infer<typeof atualizarCategoriaSchema>;

export const orientacaoModeloSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(2).max(140),
  conteudo: z.string().trim().min(1),
  ordem: z.coerce.number().int().min(1),
});

export const etapaModeloSchema = z.object({
  id: z.string().uuid().optional(),
  titulo: z.string().trim().min(2).max(180),
  instrucao: z.string().trim().max(4000).nullable().optional(),
  ordem: z.coerce.number().int().min(1),
});

export const faseModeloSchema = z.object({
  id: z.string().uuid().optional(),
  nome: z.string().trim().min(2).max(140),
  ordem: z.coerce.number().int().min(1),
  etapas: z.array(etapaModeloSchema).min(1),
});

export const criarModeloSchema = z.object({
  categoriaId: z.string().uuid(),
  nome: z.string().trim().min(3).max(180),
  descricaoCurta: z.string().trim().min(3).max(300),
  orientacoes: z.array(orientacaoModeloSchema).min(1),
  fases: z.array(faseModeloSchema).min(1),
});
export type CriarModeloDto = z.infer<typeof criarModeloSchema>;

export const atualizarModeloSchema = criarModeloSchema
  .extend({
    status: z.enum(["RASCUNHO", "PUBLICADO", "INATIVO"]).optional(),
  })
  .partial()
  .refine((dto) => Object.keys(dto).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });
export type AtualizarModeloDto = z.infer<typeof atualizarModeloSchema>;

export const listarModelosSchema = z.object({
  status: z
    .enum(["RASCUNHO", "PUBLICADO", "INATIVO", "todos"])
    .default("PUBLICADO"),
  categoriaId: z.string().uuid().optional(),
  busca: z.string().trim().max(120).optional(),
});
export type ListarModelosDto = z.infer<typeof listarModelosSchema>;

export const iniciarExecucaoSchema = z.object({
  titulo: z.string().trim().min(3).max(220),
  teste: z.boolean().optional().default(false),
});
export type IniciarExecucaoDto = z.infer<typeof iniciarExecucaoSchema>;

export const listarExecucoesSchema = z.object({
  status: z
    .enum(["EM_ANDAMENTO", "CONCLUIDA", "CANCELADA", "todos"])
    .default("EM_ANDAMENTO"),
  teste: z.coerce.boolean().optional(),
  busca: z.string().trim().max(120).optional(),
});
export type ListarExecucoesDto = z.infer<typeof listarExecucoesSchema>;

export const editarTituloExecucaoSchema = z.object({
  titulo: z.string().trim().min(3).max(220),
});
export type EditarTituloExecucaoDto = z.infer<
  typeof editarTituloExecucaoSchema
>;

export const atualizarEtapaSchema = z.object({
  concluida: z.boolean().optional(),
  observacao: z.string().trim().max(4000).nullable().optional(),
});
export type AtualizarEtapaDto = z.infer<typeof atualizarEtapaSchema>;

export const motivoObrigatorioSchema = z.object({
  motivo: z.string().trim().min(5).max(1000),
});
export type MotivoObrigatorioDto = z.infer<typeof motivoObrigatorioSchema>;

export const reordenarSchema = z.object({
  itens: z.array(itemOrdenadoSchema).min(1),
});
export type ReordenarDto = z.infer<typeof reordenarSchema>;
