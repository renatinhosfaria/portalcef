export const WIZARD_STEP_IDS = {
  MATERIA: "materia",
  TEMA: "tema",
  OBJETIVOS: "objetivos",
  HABILIDADES: "habilidades",
  CONTEUDOS: "conteudos",
  METODOLOGIA: "metodologia",
  RECURSOS: "recursos",
  AVALIACAO: "avaliacao",
  REFORCO: "reforco",
  REVIEW: "review",
  ANEXOS: "anexos",
  CONCLUSAO: "conclusao",
} as const;

export type WizardStepId =
  (typeof WIZARD_STEP_IDS)[keyof typeof WIZARD_STEP_IDS];

export const WIZARD_STEPS = [
  { id: WIZARD_STEP_IDS.MATERIA, title: "Matéria" },
  { id: WIZARD_STEP_IDS.TEMA, title: "Tema" },
  { id: WIZARD_STEP_IDS.OBJETIVOS, title: "Objetivos" },
  { id: WIZARD_STEP_IDS.HABILIDADES, title: "Habilidades" },
  { id: WIZARD_STEP_IDS.CONTEUDOS, title: "Conteúdos" },
  { id: WIZARD_STEP_IDS.METODOLOGIA, title: "Metodologia" },
  { id: WIZARD_STEP_IDS.RECURSOS, title: "Recursos" },
  { id: WIZARD_STEP_IDS.AVALIACAO, title: "Avaliação" },
  { id: WIZARD_STEP_IDS.REFORCO, title: "Reforço" },
  { id: WIZARD_STEP_IDS.REVIEW, title: "Revisão" },
  { id: WIZARD_STEP_IDS.ANEXOS, title: "Anexos" },
  { id: WIZARD_STEP_IDS.CONCLUSAO, title: "Conclusão" },
] as const;

export const DISCIPLINAS = [
  "Língua Portuguesa",
  "Matemática",
  "Ciências",
  "História",
  "Geografia",
  "Artes",
  "Educação Física",
  "Inglês",

  "Redação",
  "Literatura",
  "Biologia",
  "Física",
  "Química",
  "Filosofia",
  "Sociologia",
];
