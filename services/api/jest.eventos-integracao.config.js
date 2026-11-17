const base = require('./jest.eventos.config');
module.exports = {
  ...base,
  testMatch: ['<rootDir>/test/eventos-concorrencia.integracao.ts'],
  testRegex: undefined,
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: { rootDir: '.', isolatedModules: true } }] },
  moduleNameMapper: {
    ...base.moduleNameMapper,
    '^@essencia/db$': '<rootDir>/../../packages/db/dist/index.js',
  },
  testTimeout: 15000,
};
