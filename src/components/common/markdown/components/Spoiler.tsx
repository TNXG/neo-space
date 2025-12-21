"use client";

import { useState } from "react";
import styles from "./Spoiler.module.css";

/**
 * Spoiler 组件
 * 使用 ||text|| 语法渲染为 <del> 元素
 * 默认状态：背景色与文字颜色相同，内容不可见（删除线也被遮住）
 * 悬停状态：背景变为透明，内容显示，并在鼠标位置显示简洁提示
 * 打印时：显示删除线效果
 */
export const Spoiler = ({ children }: { children: React.ReactNode }) => {
	const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

	const handleMouseMove = (e: React.MouseEvent) => {
		setTooltip({ x: e.clientX, y: e.clientY });
	};

	const handleMouseLeave = () => {
		setTooltip(null);
	};

	return (
		<>
			<del
				className={styles.spoiler}
				onMouseMove={handleMouseMove}
				onMouseLeave={handleMouseLeave}
			>
				{children}
			</del>
			{tooltip && (
				<div
					className={styles.tooltip}
					style={{
						left: `${tooltip.x}px`,
						top: `${tooltip.y - 40}px`,
					}}
				>
					你知道的太多了
				</div>
			)}
		</>
	);
};
