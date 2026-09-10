{
  "preset": "jest-expo",
  "testEnvironment": "node",
  "roots": ["<rootDir>/__tests__"],
  "testMatch": [
    "**/__tests__/**/*.test.ts",
    "**/__tests__/**/*.test.tsx"
  ],
  "transform": {
    "^.+\\.(ts|tsx)$": ["babel-jest", { "configFile": "./babel.config.js" }]
  },
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react Native SVG transformer)"
  ],
  "moduleNameMapper": {
    "^react-native$": "react-native",
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$": "<rootDir>/__tests__/__mocks__/fileMock.js"
  },
  "setupFilesAfterEnv": ["<rootDir>/__tests__/setup.ts"],
  "collectCoverageFrom": [
    "services/**/*.ts",
    "context/**/*.tsx",
    "utils/**/*.ts"
  ],
  "coverageDirectory": "<rootDir>/coverage",
  "verbose": true
}
