export interface NavItem {
  id: string;
  title: string;
  icon: string;
  href: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "home", title: "首页", icon: "mingcute:home-2-line", href: "/" },
  { id: "articles", title: "文章", icon: "mingcute:book-2-line", href: "/posts" },
  { id: "notes", title: "手记", icon: "mingcute:pen-line", href: "/notes" },
  { id: "friends", title: "友链", icon: "mingcute:group-line", href: "/friends" },
  { id: "about", title: "关于", icon: "mingcute:user-4-line", href: "/about-me" },
];
