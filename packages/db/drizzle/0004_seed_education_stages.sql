-- Migration: 0004 - Seed education_stages
-- Populates the education_stages table with the 5 default education stages

INSERT INTO education_stages (id, code, name, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'BERCARIO', 'Berçário', NOW(), NOW()),
  (gen_random_uuid(), 'INFANTIL', 'Infantil', NOW(), NOW()),
  (gen_random_uuid(), 'FUNDAMENTAL_I', 'Fundamental I', NOW(), NOW()),
  (gen_random_uuid(), 'FUNDAMENTAL_II', 'Fundamental II', NOW(), NOW()),
  (gen_random_uuid(), 'MEDIO', 'Médio', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;
