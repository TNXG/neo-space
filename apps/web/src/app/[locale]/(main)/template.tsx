import type { ReactNode } from "react";
import { ViewTransition } from "react";

/** 随公共路由重新挂载，让正文参与进入、退出及共享视图过渡。 */
export default function MainTemplate({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      name="page-content"
      enter={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "page-transition",
      }}
      exit={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "page-transition",
      }}
      share={{
        "nav-forward": "nav-forward",
        "nav-back": "nav-back",
        default: "page-transition",
      }}
      update="none"
      default="none"
    >
      <div className="min-w-0">{children}</div>
    </ViewTransition>
  );
}
