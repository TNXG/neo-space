import styles from "./Spoiler.module.css";

/**
 * Spoiler 组件
 * 使用 ||text|| 语法渲染为 <del> 元素
 * 默认状态：背景色与文字颜色相同，内容不可见（删除线也被遮住）
 * 悬停状态：背景变为透明，内容显示
 * 打印时：显示删除线效果
 */
export const Spoiler = ({ children }: { children: React.ReactNode }) => {
	return (
		<del className={styles.spoiler} title="你知道的太多了">
			{children}
		</del>
	);
};
