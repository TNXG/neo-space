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
					parts.push(
						<span
							// 3. Key 策略：使用内容+偏移量，确保绝对唯一且稳定
							key={`abbr-${token.value}-${tokenStart}`}
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
			}

			// 补全剩余文本
			if (currentIndex < text.length) {
				parts.push(text.slice(currentIndex));
			}

			// 使用 Fragment 包裹，避免返回数组导致某些父级报错
			// 使用文本内容的前后部分和长度来确保唯一性，避免哈希冲突
			const textKey = text.length > 20 
				? `${text.slice(0, 10)}...${text.slice(-10)}-${text.length}`
				: `${text}-${text.length}`;
			return <Fragment key={`frag-${textKey}`}>{parts}</Fragment>;
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
			// 既然 ESLint 讨厌 Children.map，且 node 本质就是数组，直接用 Array.isArray 最纯粹
			if (Array.isArray(node)) {
				return node.map(child => traverse(child));
			}

			// Case C: React 元素 -> 递归 children 并重建
			if (isValidElement(node)) {
				// 5. TypeScript 类型断言的最佳实践
				// 不用 any，而是断言为“可能包含 children 的通用 ReactElement”
				const element = node as ReactElement<
					{ children?: ReactNode } & Record<string, unknown>
				>;

				const { children: nodeChildren, ...restProps } = element.props;

				// 只有当存在 children 时才需要克隆和递归
				// 如果没有 children (如 <img />, <hr />)，直接返回原节点以节省性能
				if (nodeChildren) {
					const newChildren = traverse(nodeChildren);

					// 6. 使用 createElement 代替 cloneElement
					// 显式提取 key 和 ref，这是 cloneElement 内部做的魔法，我们手动做更透明
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

// 为什么我觉得这是“最佳实现”？
// 直面 children 的本质：
// React 的 children 在运行时：要么是基本类型，要么是对象（Element），要么是数组。
// 代码直接用 Array.isArray 和 isValidElement 处理，剥离了 React Legacy API (Children.map) 的魔法，代码逻辑是裸露的 JS，这反而最健壮，不容易过时。

// 解决了 TypeScript 的痛点：
// element.props 默认在 TS 里很难推断。
// 使用 as ReactElement<{ children?: ReactNode } & Record<string, unknown>> 是最诚实的写法：我们知道它是个元素，可能有 children，也可能有其他一堆我们不关心的 props（Record）。
// 重建组件的正确性：
// 很多简单的实现会漏掉 element.key 和 ref。
// 如果你用 createElement 重新包裹一个 <input ref={inputRef} /> 却没传 ref，父组件的功能就挂了。这个实现显式保留了它们。

// 性能防御：
// 如果 isValidElement 里的节点没有 children（比如 <img />），代码直接 return node，跳过了 createElement 的开销。
// useMemo 包裹了整个递归过程，只有当 children 真正变化时才会重新计算。

// 还有更好的方案吗？
// 如果在不改变 API（必须传入 children）的前提下，没有了。这就是操作 VDOM 树的极限。
// 但如果能改架构，真正的最佳实践是不要递归遍历 children，而是让使用者明确指出哪里需要高亮
