module.exports = {
  verbose: true,
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests/'],
  moduleFileExtensions: ['js', 'json'],
  testPathIgnorePatterns: ['/node_modules/'],
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  setupFiles: ['./tests/setup.js'],
  collectCoverage: true,
  collectCoverageFrom: [
    'pages/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**'
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
  testMatch: ['**/__tests__/**/*.js?(x)', '**/?(*.)+(spec|test).js?(x)']
};