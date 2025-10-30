module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node', // Integration tests use node environment, not jsdom
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/integration/**/*.test.+(ts|tsx|js)',
  ],
  testPathIgnorePatterns: ['/setup.ts$/', '/__mocks__/'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
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
