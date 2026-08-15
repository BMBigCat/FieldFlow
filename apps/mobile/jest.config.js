/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
  moduleNameMapper: {
    "^expo-sqlite$": "<rootDir>/src/test/mocks/expo-sqlite.ts",
    "^expo-crypto$": "<rootDir>/src/test/mocks/expo-crypto.ts",
    "^expo-file-system$": "<rootDir>/src/test/mocks/expo-file-system.ts",
  },
  testMatch: ["<rootDir>/src/**/__tests__/**/*.test.ts"],
};
