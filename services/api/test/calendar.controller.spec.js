const fs = require("fs");
const path = require("path");

describe("CalendarController", () => {
  const controllerPath = path.join(
    __dirname,
    "..",
    "src",
    "modules",
    "calendar",
    "calendar.controller.ts",
  );

  let content;

  beforeAll(() => {
    content = fs.readFileSync(controllerPath, "utf8");
  });

  describe("Guards", () => {
    it("should use AuthGuard", () => {
      expect(content).toContain("@UseGuards(AuthGuard");
    });

    it("should use RolesGuard", () => {
      expect(content).toContain("RolesGuard");
    });

    it("should use TenantGuard", () => {
      expect(content).toContain("TenantGuard");
    });
  });

  describe("VIEW_ROLES", () => {
    it("should include master", () => {
      expect(content).toContain('"master"');
    });

    it("should include diretora_geral", () => {
      expect(content).toContain('"diretora_geral"');
    });

    it("should include gerente_unidade", () => {
      expect(content).toContain('"gerente_unidade"');
    });

    it("should include coordenadora_geral", () => {
      expect(content).toContain('"coordenadora_geral"');
    });

    it("should include analista_pedagogico", () => {
      expect(content).toContain('"analista_pedagogico"');
    });

    it("should NOT include professora (no access to calendar)", () => {
      // professora should not be in VIEW_ROLES
      const viewRolesMatch = content.match(
        /const VIEW_ROLES = \[([\s\S]*?)\] as const/,
      );
      if (viewRolesMatch) {
        expect(viewRolesMatch[1]).not.toContain('"professora"');
      }
    });
  });

  describe("EDIT_ROLES", () => {
    it("should include roles that can create/edit events", () => {
      expect(content).toContain("const EDIT_ROLES");
    });

    it("should NOT include gerente_financeiro (read-only)", () => {
      const editRolesMatch = content.match(
        /const EDIT_ROLES = \[([\s\S]*?)\] as const/,
      );
      if (editRolesMatch) {
        expect(editRolesMatch[1]).not.toContain('"gerente_financeiro"');
      }
    });

    it("should NOT include analista_pedagogico (read-only)", () => {
      const editRolesMatch = content.match(
        /const EDIT_ROLES = \[([\s\S]*?)\] as const/,
      );
      if (editRolesMatch) {
        expect(editRolesMatch[1]).not.toContain('"analista_pedagogico"');
      }
    });
  });

  describe("DELETE_ROLES", () => {
    it("should include master", () => {
      const deleteRolesMatch = content.match(
        /const DELETE_ROLES = \[([\s\S]*?)\] as const/,
      );
      expect(deleteRolesMatch).toBeTruthy();
      expect(deleteRolesMatch[1]).toContain('"master"');
    });

    it("should include diretora_geral", () => {
      const deleteRolesMatch = content.match(
        /const DELETE_ROLES = \[([\s\S]*?)\] as const/,
      );
      expect(deleteRolesMatch[1]).toContain('"diretora_geral"');
    });

    it("should include gerente_unidade", () => {
      const deleteRolesMatch = content.match(
        /const DELETE_ROLES = \[([\s\S]*?)\] as const/,
      );
      expect(deleteRolesMatch[1]).toContain('"gerente_unidade"');
    });

    it("should include coordenadora_geral", () => {
      const deleteRolesMatch = content.match(
        /const DELETE_ROLES = \[([\s\S]*?)\] as const/,
      );
      expect(deleteRolesMatch[1]).toContain('"coordenadora_geral"');
    });

    it("should NOT include coordenadora_bercario (cannot delete)", () => {
      const deleteRolesMatch = content.match(
        /const DELETE_ROLES = \[([\s\S]*?)\] as const/,
      );
      expect(deleteRolesMatch[1]).not.toContain('"coordenadora_bercario"');
    });
  });

  describe("Endpoints", () => {
    it("should have GET /events endpoint", () => {
      expect(content).toContain('@Get("events")');
    });

    it("should have GET /events/:id endpoint", () => {
      expect(content).toContain('@Get("events/:id")');
    });

    it("should have POST /events endpoint", () => {
      expect(content).toContain('@Post("events")');
    });

    it("should have PUT /events/:id endpoint", () => {
      expect(content).toContain('@Put("events/:id")');
    });

    it("should have DELETE /events/:id endpoint", () => {
      expect(content).toContain('@Delete("events/:id")');
    });

    it("should have GET /stats endpoint", () => {
      expect(content).toContain('@Get("stats")');
    });
  });

  describe("Response format", () => {
    it("should return success: true in responses", () => {
      expect(content).toContain("success: true");
    });

    it("should return data in responses", () => {
      expect(content).toContain("data:");
    });
  });

  describe("Validation", () => {
    it("should validate query params with Zod schema", () => {
      expect(content).toContain("queryCalendarEventsSchema.safeParse");
    });

    it("should validate create body with Zod schema", () => {
      expect(content).toContain("createCalendarEventSchema.safeParse");
    });

    it("should validate update body with Zod schema", () => {
      expect(content).toContain("updateCalendarEventSchema.safeParse");
    });

    it("should return VALIDATION_ERROR code on invalid input", () => {
      expect(content).toContain("VALIDATION_ERROR");
    });
  });
});
