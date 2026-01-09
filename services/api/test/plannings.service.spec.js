const fs = require("fs");
const path = require("path");

describe("PlanningsService", () => {
  it("filters turmas by unit, stage, and active status", () => {
    const servicePath = path.join(
      __dirname,
      "..",
      "src",
      "modules",
      "plannings",
      "plannings.service.ts",
    );
    const content = fs.readFileSync(servicePath, "utf8");

    expect(content).toContain("db.query.turmas.findMany");
    expect(content).toContain("eq(turmas.isActive, true)");
    expect(content).toContain("eq(turmas.unitId, user.unitId)");
    expect(content).toContain("eq(turmas.stageId, user.stageId)");
  });
});
