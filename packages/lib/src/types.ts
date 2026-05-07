import type { UserRole } from "@essencia/shared/schemas";

export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  school: string;
  unit: string;
  schoolId: string | null;
  unitId: string | null;
  stageId: string | null;
  status: "active" | "inactive";
  inativadoEm: string | null; // ISO string from API; null when active
  lastActive: string;
};
