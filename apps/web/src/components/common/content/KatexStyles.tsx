"use client";

import { useEffect } from "react";

import "katex/dist/katex.min.css";

/**
 * 客户端组件，用于按需加载 KaTeX 样式
 * 只在包含数学公式的页面渲染此组件
 * 包含移动端适配样式，优化小屏幕显示效果
 */
export function KatexStyles() {
  useEffect(() => {
    // 检查是否已经注入过样式
    if (document.getElementById("katex-mobile-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "katex-mobile-styles";
    style.textContent = `
      /* KaTeX 移动端适配 */
      
      /* 块级公式容器 - 支持横向滚动 */
      .katex-display {
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        padding: 1rem 0;
        margin: 1.5rem 0;
        position: relative;
      }
      
      /* 移动端块级公式滚动条样式 */
      .katex-display::-webkit-scrollbar {
        height: 6px;
      }
      
      .katex-display::-webkit-scrollbar-track {
        background: oklch(0.95 0.01 240 / 0.3);
        border-radius: 3px;
      }
      
      .katex-display::-webkit-scrollbar-thumb {
        background: oklch(0.65 0.2 180 / 0.6);
        border-radius: 3px;
        transition: background 0.2s ease;
      }
      
      .katex-display::-webkit-scrollbar-thumb:hover {
        background: oklch(0.65 0.2 180 / 0.8);
      }
      
      /* 深色模式滚动条 */
      .dark .katex-display::-webkit-scrollbar-track {
        background: oklch(0.2 0.02 240 / 0.3);
      }
      
      .dark .katex-display::-webkit-scrollbar-thumb {
        background: oklch(0.65 0.2 180 / 0.5);
      }
      
      .dark .katex-display::-webkit-scrollbar-thumb:hover {
        background: oklch(0.65 0.2 180 / 0.7);
      }
      
      /* 块级公式内部确保不换行 */
      .katex-display > .katex {
        white-space: nowrap;
        display: inline-block;
        min-width: 100%;
      }
      
      /* 行内公式基础样式 */
      .katex {
        font-size: 1.1em;
        line-height: 1.6;
      }
      
      /* 平板端适配 (641px - 1024px) */
      @media (max-width: 1024px) and (min-width: 641px) {
        .katex {
          font-size: 1.05em;
        }
        
        .katex-display {
          padding: 0.875rem 0;
          margin: 1.25rem 0;
        }
      }
      
      /* 移动端适配 (≤640px) */
      @media (max-width: 640px) {
        .katex {
          font-size: 1em;
          line-height: 1.5;
        }
        
        .katex-display {
          margin: 1rem -0.5rem;
          padding: 0.75rem 0.5rem;
          border-radius: 12px;
          background: oklch(0.98 0.01 240 / 0.5);
          backdrop-filter: blur(8px);
          box-shadow: 0 2px 8px oklch(0 0 0 / 0.05);
        }
        
        /* 移动端块级公式字体调整 */
        .katex-display > .katex {
          font-size: 0.92em;
        }
        
        /* 滚动提示渐变 */
        .katex-display::after {
          content: '';
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 2rem;
          background: linear-gradient(to left, oklch(0.98 0.01 240 / 0.5), transparent);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .katex-display:not(:hover)::after {
          opacity: 1;
        }
      }
      
      /* 小屏手机适配 (≤480px) */
      @media (max-width: 480px) {
        .katex {
          font-size: 0.95em;
        }
        
        .katex-display {
          margin: 0.875rem -0.5rem;
          padding: 0.625rem 0.5rem;
        }
        
        .katex-display > .katex {
          font-size: 0.88em;
        }
      }
      
      /* 超小屏幕适配 (≤375px) */
      @media (max-width: 375px) {
        .katex {
          font-size: 0.9em;
        }
        
        .katex-display {
          margin: 0.75rem -0.5rem;
          padding: 0.5rem 0.5rem;
        }
        
        .katex-display > .katex {
          font-size: 0.82em;
        }
        
        /* 更明显的滚动条 */
        .katex-display::-webkit-scrollbar {
          height: 8px;
        }
      }
      
      /* 深色模式适配 */
      .dark .katex-display {
        background: oklch(0.2 0.02 240 / 0.4);
        box-shadow: 0 2px 8px oklch(0 0 0 / 0.2);
      }
      
      @media (max-width: 640px) {
        .dark .katex-display::after {
          background: linear-gradient(to left, oklch(0.2 0.02 240 / 0.4), transparent);
        }
      }
      
      /* 提升公式清晰度 */
      .katex {
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        text-rendering: optimizeLegibility;
      }
      
      /* 行内公式垂直对齐优化 */
      .katex-html {
        vertical-align: -0.05em;
      }
    `;
    document.head.appendChild(style);

    return () => {
      // 组件卸载时不移除样式，因为可能有其他公式还在使用
    };
  }, []);

  return null;
}
