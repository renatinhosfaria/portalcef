import { StagesController } from "./stages.controller";

jest.mock("./stages.service", () => ({
  StagesService: class StagesService {},
}));

jest.mock("@essencia/shared/schemas", () => ({
  assignUnitStagesSchema: {
    safeParse: jest.fn(() => ({ success: false, error: { flatten: () => ({}) } })),
  },
  replaceUnitStagesSchema: {
    safeParse: jest.fn(() => ({ success: false, error: { flatten: () => ({}) } })),
  },
}));

describe("StagesController", () => {
  it("retorna erro de validação quando o corpo não contém stageIds", async () => {
    const stagesService = { assignToUnit: jest.fn() };
    const controller = new StagesController(stagesService as never);

    await expect(controller.assignToUnit("unit-1", undefined as never)).resolves.toEqual(
      expect.objectContaining({ success: false }),
    );
    expect(stagesService.assignToUnit).not.toHaveBeenCalled();
  });

  it("valida o corpo antes de substituir as etapas", async () => {
    const stagesService = { replaceUnitStages: jest.fn() };
    const controller = new StagesController(stagesService as never);

    await expect(
      controller.replaceUnitStages("unit-1", { stageIds: ["invalido"] }),
    ).resolves.toEqual(expect.objectContaining({ success: false }));
    expect(stagesService.replaceUnitStages).not.toHaveBeenCalled();
  });
});
