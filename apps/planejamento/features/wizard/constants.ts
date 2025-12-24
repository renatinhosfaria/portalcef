/**
 * Wizard Configuration Constants
 * Story 2.1 - Estrutura do Wizard e Navegação
 */

export const WIZARD_STEP_IDS = {
  DADOS: "dados",
  OBJETIVOS: "objetivos",
  METODOLOGIA: "metodologia",
  RECURSOS: "recursos",
} as const;

export type WizardStepId = (typeof WIZARD_STEP_IDS)[keyof typeof WIZARD_STEP_IDS];

export const WIZARD_STEPS = [
  { id: WIZARD_STEP_IDS.DADOS, title: "Dados" },
  { id: WIZARD_STEP_IDS.OBJETIVOS, title: "Objetivos" },
  { id: WIZARD_STEP_IDS.METODOLOGIA, title: "Metodologia" },
  { id: WIZARD_STEP_IDS.RECURSOS, title: "Recursos" },
] as const;

export interface StepContentData {
  title: string;
  description: string;
}

/**
 * Placeholder content for each wizard step
 * Will be replaced with actual form components in Story 2.2
 */
export const STEP_CONTENT_MAP: Record<WizardStepId, StepContentData> = {
  [WIZARD_STEP_IDS.DADOS]: {
    title: "Dados do Planejamento",
    description:
      "Preencha as informações básicas do seu planejamento pedagógico.",
  },
  [WIZARD_STEP_IDS.OBJETIVOS]: {
    title: "Objetivos de Aprendizagem",
    description: "Defina os objetivos de aprendizagem alinhados à BNCC.",
  },
  [WIZARD_STEP_IDS.METODOLOGIA]: {
    title: "Metodologia",
    description: "Descreva a metodologia e as estratégias de ensino.",
  },
  [WIZARD_STEP_IDS.RECURSOS]: {
    title: "Recursos Didáticos",
    description: "Liste os recursos necessários para as atividades.",
  },
};
