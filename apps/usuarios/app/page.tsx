import { UsersPageContent } from "@essencia/components/users-page-content";
import type { UserSummary } from "@essencia/lib/types";
import { serverApi } from "@essencia/shared/fetchers/server";
import type { UserRole } from "@essencia/shared/schemas";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  schoolName?: string | null;
  unitName?: string | null;
  schoolId?: string | null;
  unitId?: string | null;
  stageId?: string | null;
};
export default async function Page() {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();

  let users: UserSummary[] = [];

  try {
    const fetchedUsers = await serverApi.get<ApiUser[]>("/api/users", {
      cookies: cookieString,
    });

    users = fetchedUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      school: user.schoolName ?? "N/A",
      unit: user.unitName ?? "N/A",
      schoolId: user.schoolId ?? null,
      unitId: user.unitId ?? null,
      stageId: user.stageId ?? null,
      status: "active",
      lastActive: "N/A",
    }));
  } catch (error) {
    console.error("Failed to fetch users:", error);
    // In production, might want to redirect or show error state
    // For now, returning empty list which will show "No users found"
  }

  return <UsersPageContent users={users} />;
}
