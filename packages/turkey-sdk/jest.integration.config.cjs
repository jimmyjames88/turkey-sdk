module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node', // Integration tests use node environment, not jsdom
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
      },
    ],
  },
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/integration/**/*.test.+(ts|tsx|js)',
  ],
  testPathIgnorePatterns: ['/setup.ts$/', '/__mocks__/'],
  // Handle ESM modules like jose
  transformIgnorePatterns: [
    'node_modules/(?!(jose)/)',
  ],
  // DO NOT mock jose - we want real JWKS verification
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/integration/setup.ts'],
  testTimeout: 30000, // 30 seconds for network requests
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__mocks__/**',
    '!src/__tests__/integration/**',
  ],
  coverageDirectory: 'coverage-integration',
  coverageReporters: ['text', 'lcov', 'html'],
}
