/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  transform: {
    '^.+\\.(t|j)sx?$': ['babel-jest', { configFile: './babel.config.test.js' }],
  },
  moduleNameMapper: {
    // Force all React requires to the single project copy.
    // Required when testing-library or other deps load from a different
    // node_modules than the project (e.g. in monorepo or multi-location setups).
    '^react$':             '<rootDir>/node_modules/react/index.js',
    '^react/jsx-runtime$': '<rootDir>/node_modules/react/jsx-runtime.js',
    '^react/jsx-dev-runtime$': '<rootDir>/node_modules/react/jsx-dev-runtime.js',
    '^react-dom$':         '<rootDir>/node_modules/react-dom/index.js',
    '^react-dom/client$':  '<rootDir>/node_modules/react-dom/client.js',
    // Clerk packages — stubbed so jest.mock('@clerk/nextjs', factory) works
    // even when @clerk/nextjs is not resolvable from node_modules.
    '^@clerk/(.*)$': '<rootDir>/__mocks__/clerkStub.js',
    // Path alias — mirrors tsconfig paths
    '^@/(.*)$': '<rootDir>/$1',
    // Asset stubs
    '\\.(css|less|scss|sass)$':            '<rootDir>/__mocks__/styleMock.js',
    '\\.(png|jpg|jpeg|gif|svg|ico|webp)$': '<rootDir>/__mocks__/fileMock.js',
  },
  testMatch: ['**/__tests__/**/*.[jt]s?(x)'],
}
