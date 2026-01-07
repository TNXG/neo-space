import styles from "./Mark.module.scss";

interface MarkProps {
  children: React.ReactNode;
}

/**
 * 高亮标记组件
 * 用于 ==text== 语法渲染
 * 支持基于视图时间线的滚动动画效果
 */
export function Mark({ children }: MarkProps) {
  return (
    <mark className={`${styles.mark} rounded-md`}>
      <span className="px-1">{children}</span>
    </mark>
  );
}
