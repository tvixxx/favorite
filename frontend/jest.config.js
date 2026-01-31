module.exports = {
  preset: "@vue/cli-plugin-unit-jest/presets/typescript-and-babel",
  testMatch: [
    "<rootDir>/src/**/*.spec.[jt]s?(x)",
    "<rootDir>/src/**/*.test.[jt]s?(x)",
    "<rootDir>/tests/**/*.spec.[jt]s?(x)",
    "<rootDir>/tests/**/*.test.[jt]s?(x)",
  ],
  moduleFileExtensions: ["vue", "js", "ts", "jsx", "tsx"],
  transform: {
    "^.+\\.vue$": "@vue/vue3-jest", // для Vue 3!
    "^.+\\.ts$": "ts-jest",
  },
};
