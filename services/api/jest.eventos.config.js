const base = require("./jest.config");
const mapper = { ...base.moduleNameMapper };
delete mapper["^@essencia/shared/(.*)$"];
delete mapper["^@essencia/db$"];
module.exports = {
  ...base,
  moduleNameMapper: {
    ...mapper,
    "^@essencia/shared/schemas$": "<rootDir>/test/shared-schemas-jest-shim.ts",
    "^@essencia/db$": "<rootDir>/test/db-jest-shim.ts",
  },
};
