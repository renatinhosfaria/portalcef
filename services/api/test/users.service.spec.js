const fs = require("fs");
const path = require("path");

describe("UsersService", () => {
  it("uses static import for roles to avoid ESM .ts resolution", () => {
    const servicePath = path.join(
      __dirname,
      "..",
      "src",
      "modules",
      "users",
      "users.service.ts",
    );
    const content = fs.readFileSync(servicePath, "utf8");

    expect(content).not.toContain('await import("@essencia/shared/roles")');
    expect(content).toMatch(
      /import\s+\{\s*ROLE_HIERARCHY\s*\}\s+from\s+["']@essencia\/shared\/roles["']/,
    );
  });
});
