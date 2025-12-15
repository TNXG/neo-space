import type { HighlighterGeneric } from "shiki";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";

/**
 * 创建 shiki highlighter 实例（懒加载）
 */
let highlighterPromise: Promise<HighlighterGeneric<any, any>> | null = null;

export async function getHighlighter() {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighterCore({
			themes: [import("shiki/themes/github-dark-default.mjs")],
			langs: [
				import("shiki/langs/typescript.mjs"),
				import("shiki/langs/javascript.mjs"),
				import("shiki/langs/jsx.mjs"),
				import("shiki/langs/tsx.mjs"),
				import("shiki/langs/json.mjs"),
				import("shiki/langs/css.mjs"),
				import("shiki/langs/html.mjs"),
				import("shiki/langs/markdown.mjs"),
				import("shiki/langs/bash.mjs"),
				import("shiki/langs/python.mjs"),
				import("shiki/langs/rust.mjs"),
				import("shiki/langs/go.mjs"),
			],
			engine: createOnigurumaEngine(import("shiki/wasm")),
		}) as Promise<HighlighterGeneric<any, any>>;
	}
	return highlighterPromise;
}
