import { serverApi } from "@essencia/shared/fetchers/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveDraft } from "./actions";

vi.mock("@essencia/shared/fetchers/server", () => ({
  serverApi: {
    post: vi.fn(),
    get: vi.fn(),
  },
  ServerFetchError: class ServerFetchError extends Error {
    status: number;
    code: string;

    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

vi.mock("next/headers", () => ({
  cookies: () =>
    Promise.resolve({
      getAll: () => [],
    }),
}));

const serverApiMock = serverApi as unknown as {
  post: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  serverApiMock.post.mockReset();
});

describe("Server Action: saveDraft", () => {
  it("should fail if required fields are missing", async () => {
    // @ts-ignore - Testing invalid input
    const result = await saveDraft({ turma: "" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Dados inválidos");
  });

  it("should save draft successfully with required fields", async () => {
    const input = {
      turma: "INF-1A",
      quinzena: "2025-Q01",
    };

    serverApiMock.post.mockResolvedValue({
      id: "planning-123",
      status: "RASCUNHO",
    });

    const result = await saveDraft(input);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(serverApiMock.post).toHaveBeenCalled();
  });

  it("should save draft with optional fields", async () => {
    const input = {
      turma: "INF-1A",
      quinzena: "2025-Q01",
      objetivos: "My objectives",
    };

    serverApiMock.post.mockResolvedValue({
      id: "planning-123",
      status: "RASCUNHO",
    });

    const result = await saveDraft(input);

    expect(result.success).toBe(true);
  });
});
