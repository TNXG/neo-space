"use client";

import type { Key, ReactElement, ReactNode, Ref } from "react";
import {
	createElement,
	Fragment,
	isValidElement,
	useCallback,
	useMemo,
} from "react";
import Tokenizer from "wink-tokenizer";
import { useNbnhhsh } from "./useNbnhhsh";

interface AbbreviationTextProps {
	children: ReactNode;
	className?: string;
}

// 1. 静态实例放外面，避免重复创建
const tokenizer = new Tokenizer();

function isAbbreviation(word: string): boolean {
	return /^[a-z]{3,7}$/i.test(word);
}

// 生成唯一ID的计数器（模块级别）
let globalCounter = 0;

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

	// 2. 核心文本处理逻辑：将 string 转换为 ReactNode 数组
	const processString = useCallback(
		(text: string): ReactNode => {
			if (!text)
				return text;

			const fragmentId = globalCounter++;
			const tokens = tokenizer.tokenize(text);
			const parts: ReactNode[] = [];
			let currentIndex = 0;

			for (const token of tokens) {
				const tokenStart = text.indexOf(token.value, currentIndex);

				// 补全普通文本
				if (tokenStart > currentIndex) {
					parts.push(text.slice(currentIndex, tokenStart));
				}

				// 处理缩写
				if (token.tag === "word" && isAbbreviation(token.value)) {
					const spanId = globalCounter++;
					parts.push(
						<span
							// 3. Key 策略：使用全局计数器确保绝对唯一
							key={`abbr-${spanId}`}
							onClick={e => handleClick(e, token.value)}
							className="border-b border-dashed border-primary cursor-pointer hover:text-primary hover:border-primary/80 transition-colors relative z-10"
							title="点击查询缩写含义"
						>
							{token.value}
						</span>,
					);
				} else {
					parts.push(token.value);
				}

				currentIndex = tokenStart + token.value.length;
			}

			// 补全剩余文本
			if (currentIndex < text.length) {
				parts.push(text.slice(currentIndex));
			}

			// 使用 Fragment 包裹，使用全局计数器确保唯一性
			return <Fragment key={`frag-${fragmentId}`}>{parts}</Fragment>;
		},
		[handleClick],
	);

	// 4. 递归遍历树
	const renderedContent = useMemo(() => {
		const traverse = (node: ReactNode): ReactNode => {
			// Case A: 字符串 -> 处理替换
			if (typeof node === "string") {
				return processString(node);
			}

			// Case B: 数组 -> 原生 map 递归
			if (Array.isArray(node)) {
				return node.map(child => traverse(child));
			}

			// Case C: React 元素 -> 递归 children 并重建
			if (isValidElement(node)) {
				const element = node as ReactElement<
					{ children?: ReactNode } & Record<string, unknown>
				>;

				// 跳过代码元素（code、pre）的处理，直接返回原节点
				if (element.type === "code" || element.type === "pre") {
					return node;
				}

				const { children: nodeChildren, ...restProps } = element.props;

				// 只有当存在 children 时才需要克隆和递归
				if (nodeChildren) {
					const newChildren = traverse(nodeChildren);

					return createElement(
						element.type,
						{
							...restProps,
							key: element.key as Key,
							ref: (element as any).ref as Ref<unknown>,
						},
						newChildren,
					);
				}
				return node;
			}

			// Case D: 数字、null、boolean -> 直接返回
			return node;
		};

		return traverse(children);
	}, [children, processString]);

	return <span className={className}>{renderedContent}</span>;
}
