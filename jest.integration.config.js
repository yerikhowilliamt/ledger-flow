module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.integration-spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  testEnvironment: 'node',
  testTimeout: 120000,
  moduleNameMapper: {
    '^@ledgerflow/shared-config$': '<rootDir>/packages/shared-config/src',
    '^@ledgerflow/shared-types$': '<rootDir>/packages/shared-types/src',
    '^@ledgerflow/shared-infra$': '<rootDir>/packages/shared-infra/src',
  },
  setupFiles: ['<rootDir>/jest.integration.setup.js'],
};
