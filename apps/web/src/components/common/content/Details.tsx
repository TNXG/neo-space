"use client";

import { useTranslations } from "next-intl";
import type { ReactElement, ReactNode } from "react";
import {
  Children,
  isValidElement,

  useEffect,
  useState,
} from "react";
import { Icon } from "@/lib/inline-icon";
import styles from "./Details.module.scss";

export function Details({ children, open = false }: { children: ReactNode; open?: boolean }) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(open);
  const [isAnimating, setIsAnimating] = useState(false);

  // 1. 增强型提取逻辑
  let summaryContent: ReactNode = t("common.details.summary");
  const otherChildren: ReactNode[] = [];

  // eslint-disable-next-line react/no-children-to-array
  Children.toArray(children).forEach((child) => {
    if (isValidElement(child)) {
      const element = child as ReactElement<any>;
      // 检查标签名：原生或 react-markdown 注入的 node 属性
      const tagName = (element.type as any)?.displayName
        || element.props?.node?.tagName
        || (typeof element.type === "string" ? element.type : "");

      if (tagName === "summary") {
        summaryContent = element.props.children;
      } else {
        otherChildren.push(child);
      }
    } else {
      otherChildren.push(child);
    }
  });

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault(); // 防止原生 details 的默认行为（如果外层是 details）
    if (isAnimating)
      return;

    setIsAnimating(true);
    setIsOpen(!isOpen);
  };

  // 动画结束后重置状态
  useEffect(() => {
    const timer = setTimeout(setIsAnimating, 300, false);
    return () => clearTimeout(timer);
  }, [isOpen]);

  return (
    <div className={`${styles.details} ${isOpen ? styles.open : ""}`}>
      {/* 交互头部 */}
      <button
        type="button"
        className={styles.summary}
        onClick={toggle}
        aria-expanded={isOpen}
        aria-label={isOpen ? t("common.details.collapse") : t("common.details.expand")}
      >
        <div className={styles.chevronBox}>
          <Icon
            icon="mingcute:right-line"
            className={`${styles.icon} ${isOpen ? styles.rotate : ""}`}
          />
        </div>
        <div className={styles.title}>{summaryContent}</div>
      </button>

      {/* 动画内容区：利用 CSS Grid 实现自适应高度动画，比 scrollHeight 更简洁 */}
      <div className={styles.contentGrid}>
        <div className={styles.contentInner}>
          <div className={styles.realContent}>
            {otherChildren}
          </div>
        </div>
      </div>
    </div>
  );
}
