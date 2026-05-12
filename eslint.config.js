import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/viewer-dist/**", "node_modules/**", "coverage/**"] },
  ...tseslint.configs.recommended
);
