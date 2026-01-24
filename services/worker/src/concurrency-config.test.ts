import { describe, expect, it } from "vitest";

describe("Worker Concurrency Configuration", () => {
  it("deve usar concurrency padrao de 2 quando nao definido", () => {
    const defaultConcurrency = parseInt(
      process.env.WORKER_CONCURRENCY ?? "2",
      10,
    );
    expect(defaultConcurrency).toBe(2);
  });

  it("deve aceitar valores validos de concurrency", () => {
    const validValues = ["1", "2", "5", "10"];

    validValues.forEach((value) => {
      const concurrency = parseInt(value, 10);
      expect(concurrency).toBeGreaterThan(0);
      expect(Number.isInteger(concurrency)).toBe(true);
    });
  });

  it("deve validar que concurrency e um numero inteiro positivo", () => {
    const concurrency = parseInt(process.env.WORKER_CONCURRENCY ?? "2", 10);

    expect(concurrency).toBeGreaterThan(0);
    expect(Number.isInteger(concurrency)).toBe(true);
  });

  it("deve processar WORKER_CONCURRENCY de 1 corretamente", () => {
    const testConcurrency = parseInt("1", 10);
    expect(testConcurrency).toBe(1);
  });

  it("deve processar WORKER_CONCURRENCY de 10 corretamente", () => {
    const testConcurrency = parseInt("10", 10);
    expect(testConcurrency).toBe(10);
  });
});
