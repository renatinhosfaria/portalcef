import type { Turma } from "./index";

/**
 * Turma com dados da professora titular
 */
export interface TurmaWithProfessora extends Turma {
  professora?: {
    id: string;
    name: string;
    email: string;
  } | null;
}
