import js from "@eslint/js";
import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

export default [
  {
    ignores: ["**/dist/**", "**/*.d.ts", "**/coverage/**", "**/node_modules/**"],
  },

  js.configs.recommended,

  ...tseslint.configs.recommended,

  security.configs.recommended,

  // Plain Node.js scripts (examples/, scripts/): declare the Node
  // built-ins they use. TypeScript files get these from @types/node.
  {
    files: ["**/*.mjs"],

    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        structuredClone: "readonly",
        TextDecoder: "readonly",
        URL: "readonly",
      },
    },
  },

  {
    files: ["**/*.ts"],

    languageOptions: {
      parserOptions: {
        project: false,
      },
    },

    rules: {
      "no-unused-vars": "off",

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
