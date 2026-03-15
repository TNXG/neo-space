export interface NavItem {
  id: string;
  title: string;
  icon: string;
  href: string;
  /** 下拉面板类型，不填则为普通链接 */
  dropdownType?: "home" | "posts" | "notes";
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home", title: "首页", icon: "mingcute:home-2-line", href: "/", dropdownType: "home" },
  { id: "articles", title: "文章", icon: "mingcute:book-2-line", href: "/posts", dropdownType: "posts" },
  { id: "notes", title: "手记", icon: "mingcute:pen-line", href: "/notes", dropdownType: "notes" },
  { id: "thinking", title: "想法", icon: "mingcute:light-line", href: "/thinking" },
  { id: "friends", title: "友链", icon: "mingcute:group-line", href: "/friends" },
];
