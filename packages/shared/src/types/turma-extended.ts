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
  stage?: {
    id: string;
    name: string;
    code: string;
  } | null;
  unit?: {
    id: string;
    schoolId: string;
    name: string;
    code: string;
  } | null;
}
