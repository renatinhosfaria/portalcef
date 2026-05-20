export interface StorefrontUnitLocation {
  id: string;
  name: string;
  code?: string;
}

export interface StorefrontSchoolLocation {
  id: string;
  name: string;
  code?: string;
  units: StorefrontUnitLocation[];
}

export interface ResolvedStorefrontParams {
  schoolId: string;
  unitId: string;
  schoolSlug: string;
  unitSlug: string;
  canonicalPath: string;
  isCanonical: boolean;
}

export function slugifyStorefrontSegment(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'loja';
}

export function buildStorefrontPath(
  school: Pick<StorefrontSchoolLocation, 'id' | 'name' | 'code'>,
  unit: Pick<StorefrontUnitLocation, 'id' | 'name' | 'code'>,
): string {
  return `/${getSchoolSlug(school)}/${getUnitSlug(unit)}`;
}

export function resolveStorefrontParams(
  locations: StorefrontSchoolLocation[],
  schoolSegment: string,
  unitSegment: string,
): ResolvedStorefrontParams | null {
  const normalizedSchoolSegment = normalizeSegment(schoolSegment);
  const normalizedUnitSegment = normalizeSegment(unitSegment);

  for (const school of locations) {
    const schoolSlug = getSchoolSlug(school);
    const schoolMatches = matchesSegment(normalizedSchoolSegment, school, schoolSlug);

    if (!schoolMatches) continue;

    for (const unit of school.units) {
      const unitSlug = getUnitSlug(unit);
      const unitMatches = matchesSegment(normalizedUnitSegment, unit, unitSlug);

      if (!unitMatches) continue;

      const canonicalPath = `/${schoolSlug}/${unitSlug}`;

      return {
        schoolId: school.id,
        unitId: unit.id,
        schoolSlug,
        unitSlug,
        canonicalPath,
        isCanonical:
          normalizedSchoolSegment === schoolSlug && normalizedUnitSegment === unitSlug,
      };
    }
  }

  return null;
}

function getSchoolSlug(school: Pick<StorefrontSchoolLocation, 'id' | 'name' | 'code'>): string {
  return slugifyStorefrontSegment(school.name || school.code || school.id);
}

function getUnitSlug(unit: Pick<StorefrontUnitLocation, 'id' | 'name' | 'code'>): string {
  return slugifyStorefrontSegment(unit.name || unit.code || unit.id);
}

function normalizeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment).trim().toLowerCase();
  } catch {
    return segment.trim().toLowerCase();
  }
}

function matchesSegment(
  segment: string,
  location: Pick<StorefrontSchoolLocation | StorefrontUnitLocation, 'id' | 'code'>,
  slug: string,
): boolean {
  return segment === slug || segment === location.id.toLowerCase() || segment === location.code?.toLowerCase();
}
