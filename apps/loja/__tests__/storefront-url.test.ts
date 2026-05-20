import { describe, expect, it } from 'vitest';

import {
  buildStorefrontPath,
  resolveStorefrontParams,
  slugifyStorefrontSegment,
} from '../lib/storefront-url';

const locations = [
  {
    id: '2488806b-0ac2-436c-b4e0-3995ca3fd32a',
    name: 'Colégio Essência Feliz',
    code: '0001',
    units: [
      {
        id: 'c594a8c2-cf99-45d9-b664-f99ee9623d64',
        name: 'Santa Mônica',
        code: '0001',
      },
    ],
  },
];

describe('URLs amigáveis da loja', () => {
  it('gera segmentos legíveis a partir dos nomes', () => {
    expect(slugifyStorefrontSegment('Colégio Essência Feliz')).toBe('colegio-essencia-feliz');
    expect(slugifyStorefrontSegment('Santa Mônica')).toBe('santa-monica');
  });

  it('monta o caminho público com nomes em vez de IDs internos', () => {
    const [school] = locations;
    const [unit] = school.units;

    expect(buildStorefrontPath(school, unit)).toBe('/colegio-essencia-feliz/santa-monica');
  });

  it('resolve a URL amigável para os IDs internos usados pela API', () => {
    const resolved = resolveStorefrontParams(
      locations,
      'colegio-essencia-feliz',
      'santa-monica',
    );

    expect(resolved).toMatchObject({
      schoolId: '2488806b-0ac2-436c-b4e0-3995ca3fd32a',
      unitId: 'c594a8c2-cf99-45d9-b664-f99ee9623d64',
      schoolSlug: 'colegio-essencia-feliz',
      unitSlug: 'santa-monica',
      canonicalPath: '/colegio-essencia-feliz/santa-monica',
      isCanonical: true,
    });
  });

  it('mantém compatibilidade com links antigos em UUID e informa a URL canônica', () => {
    const resolved = resolveStorefrontParams(
      locations,
      '2488806b-0ac2-436c-b4e0-3995ca3fd32a',
      'c594a8c2-cf99-45d9-b664-f99ee9623d64',
    );

    expect(resolved).toMatchObject({
      schoolId: '2488806b-0ac2-436c-b4e0-3995ca3fd32a',
      unitId: 'c594a8c2-cf99-45d9-b664-f99ee9623d64',
      canonicalPath: '/colegio-essencia-feliz/santa-monica',
      isCanonical: false,
    });
  });
});
