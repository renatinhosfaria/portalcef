import { afterEach, describe, expect, it, vi } from "vitest";
import { createEventoAutosaveController } from "./use-evento-autosave";

describe("controlador de autosave", () => {
  afterEach(() => vi.useRealTimers());
  it("faz debounce e envia o valor mais recente", async () => { vi.useFakeTimers(); const save = vi.fn().mockResolvedValue(undefined); const c = createEventoAutosaveController({ eventId: "e", serialize: (v: string) => v, save }); c.update("um", true); c.update("dois", true); vi.advanceTimersByTime(499); expect(save).not.toHaveBeenCalled(); vi.advanceTimersByTime(1); await vi.runAllTimersAsync(); expect(save).toHaveBeenCalledTimes(1); expect(save).toHaveBeenCalledWith("dois", "e"); });
  it("permite retry após erro de rede e preserva valor", async () => { vi.useFakeTimers(); const save = vi.fn().mockRejectedValueOnce(new Error("rede")).mockResolvedValue(undefined); const c = createEventoAutosaveController({ eventId: "e", serialize: (v: string) => v, save }); c.update("local", true); vi.advanceTimersByTime(500); await vi.runAllTimersAsync(); expect(c.snapshot().state).toBe("error"); c.retry(); await vi.runAllTimersAsync(); expect(c.snapshot().state).toBe("saved"); expect(save).toHaveBeenLastCalledWith("local", "e"); });
  it("salva duas edições consecutivas sem descartar o controlador e usa callbacks atuais", async () => { vi.useFakeTimers(); const first = vi.fn().mockResolvedValue(undefined); const second = vi.fn().mockResolvedValue(undefined); const c = createEventoAutosaveController({ eventId: "e-1", serialize: (v: string) => ({ value: v }), save: first }); c.update("um", true); vi.advanceTimersByTime(500); await vi.runAllTimersAsync(); c.configure({ eventId: "e-2", serialize: (v: string) => ({ value: v, novo: true }), save: second }); c.update("dois", true); vi.advanceTimersByTime(500); await vi.runAllTimersAsync(); expect(first).toHaveBeenCalledWith({ value: "um" }, "e-1"); expect(second).toHaveBeenCalledWith({ value: "dois", novo: true }, "e-2"); expect(c.snapshot().state).toBe("saved"); });
  it("não agenda salvamentos ao apenas atualizar callbacks em rerenders", async () => { vi.useFakeTimers(); const saves = vi.fn().mockResolvedValue(undefined); const c = createEventoAutosaveController({ eventId: "e", serialize: (v: string) => v, save: saves }); c.update("valor", true); vi.advanceTimersByTime(500); await vi.runAllTimersAsync(); expect(saves).toHaveBeenCalledTimes(1); c.configure({ eventId: "e", serialize: (v: string) => v, save: vi.fn().mockResolvedValue(undefined) }); c.configure({ eventId: "e", serialize: (v: string) => v, save: vi.fn().mockResolvedValue(undefined) }); vi.advanceTimersByTime(2000); await vi.runAllTimersAsync(); expect(saves).toHaveBeenCalledTimes(1); });
  it("marca conflito VERSION_CONFLICT", async () => { vi.useFakeTimers(); const save = vi.fn().mockRejectedValue({ status: 409, code: "VERSION_CONFLICT" }); const c = createEventoAutosaveController({ eventId: "e", serialize: (v: string) => v, save }); c.update("local", true); vi.advanceTimersByTime(500); await vi.runAllTimersAsync(); expect(c.snapshot()).toMatchObject({ state: "conflict", conflict: true }); });
  it("ignora resposta stale quando chega após nova alteração", async () => { vi.useFakeTimers(); let resolve!: () => void; const save = vi.fn().mockImplementation(() => new Promise<void>((r) => { resolve = r; })); const c = createEventoAutosaveController({ eventId: "e", serialize: (v: string) => v, save }); c.update("antigo", true); vi.advanceTimersByTime(500); c.update("novo", true); resolve(); await vi.runAllTimersAsync(); expect(c.snapshot().state).not.toBe("saved"); });
  it("notifica após salvar para atualizar o readiness do workspace", async () => { vi.useFakeTimers(); const save = vi.fn().mockResolvedValue(undefined); const onSaved = vi.fn(); const c = createEventoAutosaveController({ eventId: "e", serialize: (v: string) => v, save, onSaved }); c.update("valor", true); vi.advanceTimersByTime(500); await vi.runAllTimersAsync(); expect(onSaved).toHaveBeenCalledTimes(1); });
  it("invalida o autosave pendente quando uma sessão é removida", async () => {
    vi.useFakeTimers();
    let resolveSave!: () => void;
    const save = vi.fn().mockImplementation(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
    const onSaved = vi.fn();
    const c = createEventoAutosaveController({ eventId: "e", serialize: (v: string) => v, save, onSaved });

    c.update("sessao-removida", true);
    vi.advanceTimersByTime(500);
    expect(save).toHaveBeenCalledTimes(1);

    c.invalidate();
    resolveSave();
    await vi.runAllTimersAsync();

    expect(onSaved).not.toHaveBeenCalled();
    expect(c.snapshot().state).not.toBe("saved");
  });
});
