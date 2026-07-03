const GESTAO_WORKFLOW_ROLES = [
  "master",
  "diretora_geral",
  "gerente_unidade",
  "coordenadora_geral",
];

export function isGestaoWorkflow(role: string) {
  return GESTAO_WORKFLOW_ROLES.includes(role);
}
