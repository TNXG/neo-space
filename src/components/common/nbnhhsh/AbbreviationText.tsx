"use client";

import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import Tokenizer from "wink-tokenizer";
import { useNbnhhsh } from "./useNbnhhsh";

interface AbbreviationTextProps {
	children: string;
	className?: string;
}

// 创建 tokenizer 实例
const tokenizer = new Tokenizer();

// 判断是否为可能的缩写词（3-6个字母，纯英文）
function isAbbreviation(word: string): boolean {
	return /^[a-z]{3,6}$/i.test(word);
}

export function AbbreviationText({ children, className = "" }: AbbreviationTextProps) {
	const { query } = useNbnhhsh();

	const handleClick = useCallback(
		(e: React.MouseEvent, word: string) => {
			e.stopPropagation();
			e.preventDefault();
			query(word.toLowerCase(), { x: e.pageX, y: e.pageY + 10 });
		},
		[query],
	);

	const renderedContent = useMemo((): ReactNode[] => {
		const tokens = tokenizer.tokenize(children);
		const parts: ReactNode[] = [];

		let currentIndex = 0;

		tokens.forEach((token) => {
			// 检查当前 token 之前是否有被跳过的字符（如空格、标点等）
			const tokenStart = children.indexOf(token.value, currentIndex);
			if (tokenStart > currentIndex) {
				// 添加被跳过的字符
				parts.push(children.slice(currentIndex, tokenStart));
			}

			// 只对 word 类型的 token 且符合缩写规则的进行标记
			// 排除 url, email, mention, hashtag 等类型
			if (token.tag === "word" && isAbbreviation(token.value)) {
				parts.push(
					<span
						key={`abbr-${tokenStart}-${token.value}`}
						onClick={e => handleClick(e, token.value)}
						className="border-b border-dashed border-accent-500 cursor-pointer hover:text-accent-600 hover:border-accent-600 transition-colors relative z-10"
						title="点击查询缩写含义"
					>
						{token.value}
					</span>,
				);
			} else {
				parts.push(token.value);
			}

			currentIndex = tokenStart + token.value.length;
		});

		// 添加最后剩余的字符
		if (currentIndex < children.length) {
			parts.push(children.slice(currentIndex));
		}

		return parts;
	}, [children, handleClick]);

	return <span className={className}>{renderedContent}</span>;
}
