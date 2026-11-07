import tseslint from "typescript-eslint";
import security from "eslint-plugin-security";

export default [
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs}"],
    languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
  },
];
