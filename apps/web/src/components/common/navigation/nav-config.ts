export interface NavItem {
  id: string;
  icon: string;
  href: string;
  /** 下拉面板类型，不填则为普通链接 */
  dropdownType?: "home" | "posts" | "notes";
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home", icon: "mingcute:home-2-line", href: "/", dropdownType: "home" },
  { id: "articles", icon: "mingcute:book-2-line", href: "/posts", dropdownType: "posts" },
  { id: "notes", icon: "mingcute:pen-line", href: "/notes", dropdownType: "notes" },
  { id: "thinking", icon: "mingcute:light-line", href: "/thinking" },
  { id: "donate", icon: "mingcute:heart-line", href: "/donate" },
  { id: "friends", icon: "mingcute:group-line", href: "/friends" },
];
