import { IsString, IsOptional, IsUUID, IsEnum } from "class-validator";
import type { RelatorioStatus } from "@essencia/db/schema";

export class CreateRelatorioDto {
  @IsUUID()
  turmaId!: string;

  @IsUUID()
  semestreId!: string;

  @IsOptional()
  @IsUUID()
  semestreRelatorioId?: string;
}

export class ListarRelatoriosGestaoDto {
  @IsOptional()
  @IsEnum(["BERCARIO", "INFANTIL"])
  etapa?: string;

  @IsOptional()
  @IsString()
  status?: RelatorioStatus;

  @IsOptional()
  @IsString()
  semestreId?: string;
}

// Helpers de role — análogos ao plano-aula.dto.ts
export const isAnalista = (role: string) => role === "analista_pedagogico";

export const isCoordenadora = (role: string) =>
  [
    "coordenadora_bercario",
    "coordenadora_infantil",
    "coordenadora_geral",
    "gerente_unidade",
    "diretora_geral",
    "master",
  ].includes(role);

export const isGestao = (role: string) =>
  [
    "master",
    "diretora_geral",
    "gerente_unidade",
    "gerente_financeiro",
    "coordenadora_geral",
    "coordenadora_bercario",
    "coordenadora_infantil",
    "analista_pedagogico",
  ].includes(role);

export const STATUS_URL_MAP: Record<RelatorioStatus, string> = {
  RASCUNHO: "rascunho",
  AGUARDANDO_ANALISTA: "aguardando-analista",
  AGUARDANDO_COORDENADORA: "aguardando-coordenadora",
  DEVOLVIDO_ANALISTA: "devolvido-analista",
  DEVOLVIDO_COORDENADORA: "devolvido-coordenadora",
  REVISAO_ANALISTA: "revisao-analista",
  APROVADO: "aprovado",
  RECUPERADO: "recuperado",
};
