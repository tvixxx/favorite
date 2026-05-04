import eslint from "@eslint/js";
import stylistic from "@stylistic/eslint-plugin";
import pluginVue from "eslint-plugin-vue";
import tseslint from "typescript-eslint";
import globals from "globals";
import vueParser from "vue-eslint-parser";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "coverage/**",
      "jest.config.js",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".vue"],
      },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        defineProps: "readonly",
        defineEmits: "readonly",
        defineExpose: "readonly",
        defineModel: "readonly",
      },
    },
    plugins: {
      "@stylistic": stylistic,
    },
    rules: {
      "no-console":
        process.env.NODE_ENV === "production" ? "warn" : "off",
      "no-debugger":
        process.env.NODE_ENV === "production" ? "warn" : "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@stylistic/padding-line-between-statements": [
        "warn",
        { blankLine: "always", prev: "*", next: "return" },
        { blankLine: "always", prev: "block-like", next: "*" },
      ],
    },
  },
  {
    files: ["**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
