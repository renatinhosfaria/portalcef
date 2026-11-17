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
    '^@essencia/db$': '<rootDir>/test/db-jest-shim.ts',
    '^@essencia/shared$': '<rootDir>/../../packages/shared/src/index.ts',
    '^@essencia/shared/schemas$': '<rootDir>/test/shared-schemas-jest-shim.ts',
    '^@essencia/shared/(.*)$': '<rootDir>/../../packages/shared/src/$1',
  },
  passWithNoTests: true,
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Cada processo do jest chega a ~1,4 GB. O padrão (CPUs - 1 = 5 processos) estoura a
  // memória do servidor de produção e o kernel mata os testes no meio do deploy.
  maxWorkers: 2,
};
