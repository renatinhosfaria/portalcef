import fs from "fs";
import path from "path";

const readText = (filePath: string) => fs.readFileSync(filePath, "utf8");
const isAsciiOnly = (value: string) =>
  Array.from(value).every((char) => char.charCodeAt(0) <= 0x7f);

describe("Runtime warnings regressions", () => {
  it("keeps Stripe webhook logs ASCII-only", () => {
    const filePath = path.resolve(
      __dirname,
      "../modules/payments/payments-webhook.controller.ts",
    );
    const content = readText(filePath);
    expect(isAsciiOnly(content)).toBe(true);
  });

  it("keeps Shop expiration job logs ASCII-only", () => {
    const filePath = path.resolve(
      __dirname,
      "../modules/shop/jobs/shop-expiration.job.ts",
    );
    const content = readText(filePath);
    expect(isAsciiOnly(content)).toBe(true);
  });

  it("avoids shell: true in apply-schema helper", () => {
    const filePath = path.resolve(
      __dirname,
      "../../../..",
      "packages",
      "db",
      "apply-schema.js",
    );
    const content = readText(filePath);
    expect(content).not.toMatch(/shell\\s*:\\s*true/);
    expect(content).toContain("npx.cmd");
  });
});
