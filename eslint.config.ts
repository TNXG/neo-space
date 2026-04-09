import antfu from "@antfu/eslint-config";

const atf = antfu({
  ignores: [
    "src/components/ui/**",
    "node_modules/**",
    "backend/target/**",
    ".agents/**",
    "**/AGANT.md",
  ],
  formatters: true,
  react: true,
  stylistic: {
    indent: 2,
    quotes: "double",
    semi: true,
  },
  rules: {
    "semi": ["warn", "always"],
    "antfu/top-level-function": "off",
    "eslinttailwindcss/no-custom-classname": "off",
    "no-console": "off",
    "style/brace-style": ["error", "1tbs", { allowSingleLine: true }],
    "node/prefer-global/process": "off",
  },
});

export default atf;
