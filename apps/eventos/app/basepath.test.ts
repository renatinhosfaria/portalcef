import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("proxy com basePath",()=>it("usa a URL pública completa",()=>{expect(readFileSync(new URL("./page.tsx",import.meta.url),"utf8")).toContain("/eventos/api/eventos/admin/eventos")}));
