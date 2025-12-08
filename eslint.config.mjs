import antfu from "@antfu/eslint-config";

const atf = antfu({
	ignores: [
		"src/components/ui/**",
		"node_modules/**",
	],
	formatters: true,
	unocss: true,
	react: true,
	stylistic: {
		indent: "tab",
		quotes: "double",
		semi: true,
	},
	rules: {
		"semi": ["warn", "always"],
		"antfu/top-level-function": "off",
		"eslinttailwindcss/no-custom-classname": "off",
		"no-console": ["warn", { allow: ["warn", "error"] }],
		"style/brace-style": ["error", "1tbs", { allowSingleLine: true }],
	},
});

export default atf;
