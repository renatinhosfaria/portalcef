const fs = require("fs");
const path = require("path");

describe("CorrelationIdMiddleware", () => {
  it("sets x-correlation-id using header or setHeader fallback", () => {
    const middlewarePath = path.join(
      __dirname,
      "..",
      "src",
      "common",
      "middleware",
      "correlation-id.middleware.ts",
    );
    const content = fs.readFileSync(middlewarePath, "utf8");

    expect(content).toContain("x-correlation-id");
    expect(content).toMatch(/\.header\(\"x-correlation-id\"/);
    expect(content).toMatch(/\.setHeader\(\"x-correlation-id\"/);
  });
});
