"use client";

import { useCallback } from "react";

/**
 * Dicionário de correções ortográficas comuns em português brasileiro
 * Formato: { "palavra_errada": "palavra_correta" }
 */
const CORRECTIONS: Record<string, string> = {
  // Acentuação
  basicas: "básicas",
  basicos: "básicos",
  basico: "básico",
  basica: "básica",
  matematica: "matemática",
  portugues: "português",
  ciencias: "ciências",
  historia: "história",
  ingles: "inglês",
  educacao: "educação",
  avaliacao: "avaliação",
  operacoes: "operações",
  operacao: "operação",
  adicao: "adição",
  subtracao: "subtração",
  multiplicacao: "multiplicação",
  divisao: "divisão",
  fracao: "fração",
  fracoes: "frações",
  equacao: "equação",
  equacoes: "equações",
  funcao: "função",
  funcoes: "funções",
  grafico: "gráfico",
  graficos: "gráficos",
  numero: "número",
  numeros: "números",
  calculo: "cálculo",
  calculos: "cálculos",
  geometria: "geometria",
  algebra: "álgebra",
  estatistica: "estatística",
  probabilidade: "probabilidade",
  sequencia: "sequência",
  sequencias: "sequências",
  padrao: "padrão",
  padroes: "padrões",
  logica: "lógica",
  analise: "análise",
  sintese: "síntese",
  interpretacao: "interpretação",
  compreensao: "compreensão",
  producao: "produção",
  redacao: "redação",
  gramatica: "gramática",
  ortografia: "ortografia",
  vocabulario: "vocabulário",
  leitura: "leitura",
  escrita: "escrita",
  comunicacao: "comunicação",
  expressao: "expressão",
  expressoes: "expressões",
  linguagem: "linguagem",
  literatura: "literatura",
  genero: "gênero",
  generos: "gêneros",
  textual: "textual",
  narrativa: "narrativa",
  descricao: "descrição",
  argumentacao: "argumentação",
  dissertacao: "dissertação",
  exposicao: "exposição",
  // Verbos comuns
  desenvolver: "desenvolver",
  compreender: "compreender",
  identificar: "identificar",
  reconhecer: "reconhecer",
  aplicar: "aplicar",
  analisar: "analisar",
  sintetizar: "sintetizar",
  avaliar: "avaliar",
  criar: "criar",
  construir: "construir",
  // Erros comuns
  concerteza: "com certeza",
  derrepente: "de repente",
  menas: "menos",
  mais: "mais", // deixar como está
  mas: "mas", // deixar como está
  agente: "a gente",
  aonde: "aonde", // contexto específico
  onde: "onde",
  porque: "porque", // contexto específico
  "por que": "por que",
  porquê: "porquê",
  atraves: "através",
  atras: "atrás",
  voce: "você",
  tambem: "também",
  ja: "já",
  so: "só",
  nos: "nós",
  e: "é", // cuidado com contexto
  ha: "há",
  obrigado: "obrigado",
  obrigada: "obrigada",
  // Educação
  aprendizagem: "aprendizagem",
  pedagogia: "pedagogia",
  pedagogico: "pedagógico",
  pedagogica: "pedagógica",
  metodologia: "metodologia",
  metodologico: "metodológico",
  metodologica: "metodológica",
  didatica: "didática",
  didatico: "didático",
  curriculo: "currículo",
  curricular: "curricular",
  conteudo: "conteúdo",
  conteudos: "conteúdos",
  objetivo: "objetivo",
  objetivos: "objetivos",
  habilidade: "habilidade",
  habilidades: "habilidades",
  competencia: "competência",
  competencias: "competências",
  atividade: "atividade",
  atividades: "atividades",
  exercicio: "exercício",
  exercicios: "exercícios",
  tarefa: "tarefa",
  tarefas: "tarefas",
  prova: "prova",
  provas: "provas",
  trabalho: "trabalho",
  trabalhos: "trabalhos",
  projeto: "projeto",
  projetos: "projetos",
  pesquisa: "pesquisa",
  pesquisas: "pesquisas",
  estudo: "estudo",
  estudos: "estudos",
  revisao: "revisão",
  revisoes: "revisões",
  correcao: "correção",
  correcoes: "correções",
  recuperacao: "recuperação",
  reforco: "reforço",
  apoio: "apoio",
  acompanhamento: "acompanhamento",
  // Ciências
  biologia: "biologia",
  biologico: "biológico",
  quimica: "química",
  quimico: "químico",
  fisica: "física",
  fenomeno: "fenômeno",
  fenomenos: "fenômenos",
  experimento: "experimento",
  experimentos: "experimentos",
  hipotese: "hipótese",
  hipoteses: "hipóteses",
  teoria: "teoria",
  teorias: "teorias",
  metodo: "método",
  metodos: "métodos",
  cientifico: "científico",
  cientifica: "científica",
  observacao: "observação",
  observacoes: "observações",
  conclusao: "conclusão",
  conclusoes: "conclusões",
  // Geografia e História
  geografia: "geografia",
  geografico: "geográfico",
  territorio: "território",
  territorios: "territórios",
  populacao: "população",
  populacoes: "populações",
  regiao: "região",
  regioes: "regiões",
  pais: "país",
  paises: "países",
  nacao: "nação",
  nacoes: "nações",
  sociedade: "sociedade",
  politica: "política",
  politico: "político",
  economica: "econômica",
  economico: "econômico",
  economia: "economia",
  cultura: "cultura",
  cultural: "cultural",
  civilizacao: "civilização",
  civilizacoes: "civilizações",
  revolucao: "revolução",
  revolucoes: "revoluções",
  independencia: "independência",
  republica: "república",
  democracia: "democracia",
  democratico: "democrático",
  democratica: "democrática",
  // Artes
  arte: "arte",
  artes: "artes",
  artistico: "artístico",
  artistica: "artística",
  musica: "música",
  musical: "musical",
  teatro: "teatro",
  teatral: "teatral",
  danca: "dança",
  pintura: "pintura",
  desenho: "desenho",
  escultura: "escultura",
  fotografia: "fotografia",
  cinema: "cinema",
  estetica: "estética",
  estetico: "estético",
  criatividade: "criatividade",
  imaginacao: "imaginação",
  // Educação Física
  esporte: "esporte",
  esportes: "esportes",
  movimento: "movimento",
  movimentos: "movimentos",
  coordenacao: "coordenação",
  equilibrio: "equilíbrio",
  flexibilidade: "flexibilidade",
  resistencia: "resistência",
  forca: "força",
  velocidade: "velocidade",
  agilidade: "agilidade",
  saude: "saúde",
  bemestar: "bem-estar",
  nutricao: "nutrição",
  alimentacao: "alimentação",
};

/**
 * Corrige uma palavra se ela estiver no dicionário
 */
function correctWord(word: string): string {
  if (!word) return word;
  const lowerWord = word.toLowerCase();
  const correction = CORRECTIONS[lowerWord];

  if (correction) {
    // Preservar capitalização original
    const firstChar = word[0];
    if (firstChar && firstChar === firstChar.toUpperCase()) {
      return correction.charAt(0).toUpperCase() + correction.slice(1);
    }
    return correction;
  }

  return word;
}

/**
 * Corrige um texto completo, palavra por palavra
 */
export function correctText(text: string): string {
  if (!text) return text;

  // Dividir em palavras mantendo espaços e pontuação
  const parts = text.split(/(\s+|[.,!?;:()[\]{}"""'']+)/);

  const correctedParts = parts.map((part) => {
    // Se for espaço ou pontuação, manter como está
    if (/^(\s+|[.,!?;:()[\]{}"""'']+)$/.test(part)) {
      return part;
    }
    return correctWord(part);
  });

  return correctedParts.join("");
}

/**
 * Hook para correção ortográfica em campos de texto
 * Retorna uma função que corrige o texto quando chamada (ex: onBlur)
 */
export function useSpellCheck() {
  const correct = useCallback((text: string): string => {
    return correctText(text);
  }, []);

  return { correct, correctText };
}
