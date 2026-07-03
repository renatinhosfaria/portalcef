import * as fs from "node:fs";
import * as path from "node:path";

describe("configuracao do Nginx para workflows", () => {
  const nginxConfigPath = path.resolve(__dirname, "../../../../nginx.conf");

  it("roteia assets estaticos do workflows antes do fallback generico", () => {
    const config = fs.readFileSync(nginxConfigPath, "utf8");
    const workflowsStaticLocation =
      "location ^~ /workflows/_next/static/ {";
    const genericAssetsLocation =
      "location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$";

    const workflowsStaticIndex = config.indexOf(workflowsStaticLocation);
    const genericAssetsIndex = config.indexOf(genericAssetsLocation);

    expect(workflowsStaticIndex).toBeGreaterThanOrEqual(0);
    expect(genericAssetsIndex).toBeGreaterThanOrEqual(0);
    expect(workflowsStaticIndex).toBeLessThan(genericAssetsIndex);

    const workflowsStaticBlock = config.slice(
      workflowsStaticIndex,
      config.indexOf("\n        }", workflowsStaticIndex),
    );

    expect(workflowsStaticBlock).toContain(
      "set $upstream_workflows essencia-workflows:3015;",
    );
    expect(workflowsStaticBlock).toContain(
      "proxy_pass http://$upstream_workflows;",
    );
    expect(workflowsStaticBlock).toContain("proxy_cache static_cache;");
  });
});
