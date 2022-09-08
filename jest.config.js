module.exports = {
  moduleFileExtensions: [
    'ts',
    'js'
  ],
  transform: {
    '^.+\\.ts$': '<rootDir>/node_modules/babel-jest'
  },
  testRegex: '/src/.*\\.spec.(ts|js)$',
  collectCoverageFrom: [
    'src/WfsDataParser.ts'
  ],
  automock: false,
  setupFiles: [
    '<rootDir>/src/setupTests.ts'
  ],
  testEnvironmentOptions: {
    'url': 'http://localhost/'
  }
};
