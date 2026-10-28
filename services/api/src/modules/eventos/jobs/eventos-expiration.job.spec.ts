import { EventosExpirationJob } from "./eventos-expiration.job";

describe("EventosExpirationJob", () => {
  it("é idempotente quando executado duas vezes", async () => {
    const sales = { liberarReservasExpiradas: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0) };
    const job = new EventosExpirationJob(sales as any);

    await expect(job.liberarExpirados(new Date("2026-10-28T12:00:00Z"))).resolves.toBe(1);
    await expect(job.liberarExpirados(new Date("2026-10-28T12:00:00Z"))).resolves.toBe(0);
    expect(sales.liberarReservasExpiradas).toHaveBeenCalledTimes(2);
  });
});
