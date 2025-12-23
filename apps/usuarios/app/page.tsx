import { cookies } from "next/headers";

import { serverApi } from "@essencia/shared/fetchers/server";
import type { User } from "@essencia/shared/types";

import { UsersPageContent } from "../components/users-page-content";
import type { UserSummary } from "../lib/types";

export const dynamic = "force-dynamic";

export default async function Page() {
  const cookieStore = await cookies();
  const cookieString = cookieStore.toString();

  let users: UserSummary[] = [];

  try {
    const fetchedUsers = await serverApi.get<User[]>("/users", {
      cookies: cookieString,
    });

    users = fetchedUsers.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      unit: "Matriz - SP", // Placeholder as unit join is not yet fully implemented in API response
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
