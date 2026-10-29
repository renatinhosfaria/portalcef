import { describe, expect, it, vi } from "vitest";
import { createDraft, createDraftAndNavigate, saveDraft } from "./evento-draft-form";

describe("criação de rascunho", () => {
  it("cria e navega com basePath", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: "evt-1", slug: "festa", title: "Festa" } }), { status: 200 }))); const navigate = vi.fn(); const draft = await createDraftAndNavigate("Festa", navigate); expect(draft.slug).toBe("festa"); expect(navigate).toHaveBeenCalledWith("/eventos-admin/eventos/evt-1/informacoes"); });
  it("preserva status e code no conflito do saveDraft e envia versão", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false, error: { code: "VERSION_CONFLICT", message: "conflito" } }), { status: 409 }))); await expect(saveDraft("evt-1", { title: "Novo" }, "2026-01-01T00:00:00.000Z")).rejects.toMatchObject({ status: 409, code: "VERSION_CONFLICT" }); const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]; expect(JSON.parse(init.body)).toMatchObject({ expectedUpdatedAt: "2026-01-01T00:00:00.000Z" }); });
  it("envia título uma única vez na criação", async () => { vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true, data: { id: "e", slug: "x", title: "X" } }), { status: 200 }))); await createDraft("X"); expect(fetch).toHaveBeenCalledTimes(1); });
});
