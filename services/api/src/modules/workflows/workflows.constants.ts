import type { UserRole } from "@essencia/shared/types";

export const WORKFLOW_ROLES_ACESSO = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "gerente_financeiro",
  "coordenadora_geral",
  "coordenadora_bercario",
  "coordenadora_infantil",
  "coordenadora_fundamental_i",
  "coordenadora_fundamental_ii",
  "coordenadora_medio",
  "analista_pedagogico",
  "professora",
  "auxiliar_administrativo",
  "auxiliar_sala",
] as const satisfies readonly UserRole[];

export const WORKFLOW_GESTAO_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
] as const satisfies readonly UserRole[];

export const CATEGORIAS_PADRAO = [
  "Eventos",
  "Documentos",
  "Matricula",
  "Pedagogico",
  "Administrativo",
] as const;

export const SUGESTOES_POR_CATEGORIA = {
  eventos: {
    orientacoes: [
      { titulo: "Objetivo", conteudo: "Descreva o objetivo do evento." },
      { titulo: "Publico", conteudo: "Informe o publico participante." },
      { titulo: "Materiais", conteudo: "Liste materiais necessarios." },
      {
        titulo: "Comunicacao",
        conteudo: "Defina como as familias serao comunicadas.",
      },
    ],
    fases: [
      {
        nome: "Preparacao",
        etapas: [
          {
            titulo: "Definir data e horario",
            instrucao: "Validar no calendario escolar.",
          },
          { titulo: "Confirmar espaco", instrucao: "Reservar local e recursos." },
        ],
      },
      {
        nome: "Comunicacao",
        etapas: [
          {
            titulo: "Enviar comunicado",
            instrucao: "Enviar informacoes para as familias.",
          },
          {
            titulo: "Confirmar participacao",
            instrucao: "Acompanhar retornos recebidos.",
          },
        ],
      },
      {
        nome: "Finalizacao",
        etapas: [
          {
            titulo: "Registrar ocorrencias",
            instrucao: "Anotar aprendizados e pendencias.",
          },
        ],
      },
    ],
  },
  documentos: {
    orientacoes: [
      {
        titulo: "Documentos necessarios",
        conteudo: "Liste todos os arquivos exigidos.",
      },
      {
        titulo: "Onde enviar",
        conteudo: "Informe canal, sistema ou responsavel pelo recebimento.",
      },
    ],
    fases: [
      {
        nome: "Preparacao",
        etapas: [
          { titulo: "Reunir documentos", instrucao: "Conferir lista obrigatoria." },
          { titulo: "Validar dados", instrucao: "Checar nomes, datas e assinaturas." },
        ],
      },
      {
        nome: "Envio",
        etapas: [
          { titulo: "Enviar documentos", instrucao: "Registrar protocolo quando houver." },
          { titulo: "Acompanhar retorno", instrucao: "Verificar aprovacao ou exigencias." },
        ],
      },
    ],
  },
  matricula: {
    orientacoes: [
      { titulo: "Dados do aluno", conteudo: "Informe dados e documentos iniciais." },
      { titulo: "Responsaveis", conteudo: "Registre responsaveis e contatos." },
    ],
    fases: [
      {
        nome: "Cadastro",
        etapas: [
          { titulo: "Conferir documentos", instrucao: "Validar documentos obrigatorios." },
          { titulo: "Cadastrar aluno", instrucao: "Registrar aluno no sistema." },
        ],
      },
      {
        nome: "Integracao",
        etapas: [
          {
            titulo: "Comunicar professora",
            instrucao: "Avisar turma sobre entrada do aluno.",
          },
          { titulo: "Orientar familia", instrucao: "Enviar informacoes iniciais." },
        ],
      },
    ],
  },
  pedagogico: {
    orientacoes: [
      {
        titulo: "Objetivo pedagogico",
        conteudo: "Descreva o objetivo da rotina.",
      },
      { titulo: "Evidencias", conteudo: "Defina registros esperados." },
    ],
    fases: [
      {
        nome: "Planejamento",
        etapas: [
          {
            titulo: "Definir responsaveis",
            instrucao: "Alinhar quem executa cada acao.",
          },
          {
            titulo: "Preparar materiais",
            instrucao: "Separar materiais pedagogicos.",
          },
        ],
      },
      {
        nome: "Acompanhamento",
        etapas: [
          {
            titulo: "Registrar andamento",
            instrucao: "Anotar observacoes relevantes.",
          },
        ],
      },
    ],
  },
  administrativo: {
    orientacoes: [
      { titulo: "Objetivo", conteudo: "Descreva a rotina administrativa." },
      { titulo: "Prazos", conteudo: "Informe prazos e dependencias externas." },
    ],
    fases: [
      {
        nome: "Organizacao",
        etapas: [
          { titulo: "Levantar informacoes", instrucao: "Conferir dados necessarios." },
          { titulo: "Executar rotina", instrucao: "Realizar procedimento definido." },
        ],
      },
      {
        nome: "Conferencia",
        etapas: [
          { titulo: "Conferir resultado", instrucao: "Validar se nao ha pendencias." },
        ],
      },
    ],
  },
} as const;
