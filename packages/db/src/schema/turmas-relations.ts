import { relations } from "drizzle-orm";
import { turmas } from "./turmas";
import { users } from "./users";
import { educationStages } from "./education-stages";
import { units } from "./units";

export const turmasRelations = relations(turmas, ({ one }) => ({
  professora: one(users, {
    fields: [turmas.professoraId],
    references: [users.id],
  }),
  stage: one(educationStages, {
    fields: [turmas.stageId],
    references: [educationStages.id],
  }),
  unit: one(units, {
    fields: [turmas.unitId],
    references: [units.id],
  }),
}));
