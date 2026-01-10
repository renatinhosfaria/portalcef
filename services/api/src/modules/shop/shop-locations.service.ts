import { Injectable } from "@nestjs/common";
import { asc, getDb } from "@essencia/db";
import { schools, units, type School } from "@essencia/db/schema";

export interface ShopUnitLocation {
  id: string;
  name: string;
  code: string;
}

export interface ShopSchoolLocation {
  id: string;
  name: string;
  code: string;
  units: ShopUnitLocation[];
}

@Injectable()
export class ShopLocationsService {
  async listLocations(): Promise<ShopSchoolLocation[]> {
    const db = getDb();

    const [allSchools, allUnits] = await Promise.all([
      db.query.schools.findMany({
        columns: { id: true, name: true, code: true },
        orderBy: [asc(schools.name)],
      }),
      db.query.units.findMany({
        columns: { id: true, name: true, code: true, schoolId: true },
        orderBy: [asc(units.name)],
      }),
    ]);

    const unitsBySchool = new Map<string, ShopUnitLocation[]>();
    for (const unit of allUnits) {
      const entry = unitsBySchool.get(unit.schoolId) ?? [];
      entry.push({ id: unit.id, name: unit.name, code: unit.code });
      unitsBySchool.set(unit.schoolId, entry);
    }

    return allSchools.map((school: Pick<School, "id" | "name" | "code">) => ({
      id: school.id,
      name: school.name,
      code: school.code,
      units: unitsBySchool.get(school.id) ?? [],
    }));
  }
}
