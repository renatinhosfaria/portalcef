import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const logoPath = join(currentDir, "..", "public", "logo.png");

describe("Static assets", () => {
  it("should include logo.png in public", () => {
    expect(existsSync(logoPath)).toBe(true);
  });
});
