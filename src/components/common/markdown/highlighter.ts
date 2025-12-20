import type { HighlighterCore } from "shiki/core";
import { createHighlighterCore } from "shiki/core";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import { bundledLanguages } from "shiki/langs"; // 包含所有语言定义的映射
import darkPlus from "shiki/themes/dark-plus.mjs"; // 暗色主题
import lightPlus from "shiki/themes/light-plus.mjs"; // 明亮主题

// 定义实例类型
export type Highlighter = HighlighterCore;

let highlighterInstance: Highlighter | null = null;

/**
 * 获取 Shiki 实例，并根据传入的语言列表动态加载所需语法
 * @param langs - 需要动态加载的语言列表 (例如: ['rust', 'python'])
 */
export async function getHighlighter(langs: string[] = []): Promise<Highlighter> {
	// 1. 初始化核心实例（如果尚未存在）
	if (!highlighterInstance) {
		highlighterInstance = await createHighlighterCore({
			themes: [darkPlus, lightPlus], // 同时加载明暗两个主题
			langs: [], // 初始不加载任何语言，按需加载
			engine: createOnigurumaEngine(import("shiki/wasm")),
		});
	}

	// 2. 筛选出 Shiki 支持且尚未加载的语言
	const loadedLanguages = highlighterInstance.getLoadedLanguages();
	const languagesToLoad = langs.filter((lang) => {
		// 检查语言是否在 Shiki 支持列表中，并且未加载
		return lang in bundledLanguages && !loadedLanguages.includes(lang);
	});

	// 3. 并行加载缺失的语言
	if (languagesToLoad.length > 0) {
		await highlighterInstance.loadLanguage(
			...languagesToLoad.map(lang => bundledLanguages[lang as keyof typeof bundledLanguages]),
		);
	}

	return highlighterInstance as Highlighter;
}
