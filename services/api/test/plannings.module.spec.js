const fs = require("fs");
const path = require("path");

describe("PlanningsModule", () => {
  it("imports AuthModule so AuthGuard dependencies resolve", () => {
    const modulePath = path.join(
      __dirname,
      "..",
      "src",
      "modules",
      "plannings",
      "plannings.module.ts",
    );
    const content = fs.readFileSync(modulePath, "utf8");

    expect(content).toContain("AuthModule");
    expect(content).toMatch(/imports:\s*\[[^\]]*AuthModule[^\]]*\]/s);
  });
});
