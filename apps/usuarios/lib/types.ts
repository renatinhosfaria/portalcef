import type { UserRole } from "@essencia/shared/schemas";

export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  unit: string;
  status: "active" | "inactive";
  lastActive: string;
};
