import type { ComponentType, SVGProps } from "react";

import Book2Line from "~icons/mingcute/book-2-line";
import GroupLine from "~icons/mingcute/group-line";
import Home2Line from "~icons/mingcute/home-2-line";
import PenLine from "~icons/mingcute/pen-line";
import User4Line from "~icons/mingcute/user-4-line";

export interface NavItem {
  id: string;
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home", title: "首页", icon: Home2Line, href: "/" },
  { id: "articles", title: "文章", icon: Book2Line, href: "/posts" },
  { id: "notes", title: "手记", icon: PenLine, href: "/notes" },
  { id: "friends", title: "友链", icon: GroupLine, href: "/friends" },
  { id: "about", title: "关于", icon: User4Line, href: "/about-me" },
];
