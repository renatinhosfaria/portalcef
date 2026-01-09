const fs = require("fs");
const path = require("path");

describe("StagesController", () => {
  it("protects the stages endpoint with AuthGuard", () => {
    const controllerPath = path.join(
      __dirname,
      "..",
      "src",
      "modules",
      "stages",
      "stages.controller.ts",
    );
    const content = fs.readFileSync(controllerPath, "utf8");

    expect(content).toContain('@Controller("stages")');
    expect(content).toContain("@UseGuards(AuthGuard)");
    expect(content).toContain("@Get()");
  });
});
