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
  inativadoEm?: string | null;
  inativadoPor?: string | null;
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ inativos?: string }>;
}) {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();
  const params = await searchParams;
  const incluirInativos = params.inativos === "true";

  let users: UserSummary[] = [];

  try {
    const url = incluirInativos ? "/api/users?inativos=true" : "/api/users";
    const fetchedUsers = await serverApi.get<ApiUser[]>(url, {
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
      status: user.inativadoEm ? "inactive" : "active",
      inativadoEm: user.inativadoEm ?? null,
      lastActive: user.inativadoEm ?? "N/A",
    }));
  } catch (error) {
    console.error("Failed to fetch users:", error);
  }

  return <UsersPageContent users={users} incluirInativos={incluirInativos} />;
}
