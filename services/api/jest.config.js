/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { diagnostics: { ignoreCodes: [151002] } }],
  },
  collectCoverageFrom: ['src/**/*.(t|j)s', '!src/**/*.spec.ts', '!src/**/*.d.ts'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@essencia/db$': '<rootDir>/../../packages/db/src/index.ts',
    '^@essencia/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@essencia/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  passWithNoTests: true,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
