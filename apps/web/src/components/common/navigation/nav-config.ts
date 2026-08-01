export interface NavItem {
  id: string;
  icon: string;
  href?: string;
  /** 下拉面板类型，不填则为普通链接 */
  dropdownType?: "home" | "posts" | "notes" | "more";
  /** 下拉菜单包含的二级页面，同时用于激活态与移动端扁平展示 */
  children?: NavItem[];
}

export type NavigationTransitionType = "nav-forward" | "nav-back";

export const NAV_ITEMS: NavItem[] = [
  { id: "home", icon: "mingcute:home-2-line", href: "/", dropdownType: "home" },
  { id: "articles", icon: "mingcute:book-2-line", href: "/posts", dropdownType: "posts" },
  { id: "notes", icon: "mingcute:pen-line", href: "/notes", dropdownType: "notes" },
  { id: "thinking", icon: "mingcute:light-line", href: "/thinking" },
  { id: "friends", icon: "mingcute:group-line", href: "/friends" },
  {
    id: "more",
    icon: "mingcute:more-2-line",
    dropdownType: "more",
    children: [
      { id: "donate", icon: "mingcute:heart-line", href: "/donate" },
      { id: "bangumi", icon: "mingcute:planet-line", href: "/bangumi" },
    ],
  },
];

/** 返回移动端需要直接展示的可导航条目。 */
export function getMobileNavigationItems(): NavItem[] {
  return NAV_ITEMS.flatMap(item => item.children ?? [item]);
}

/**
 * 根据主导航的信息层级决定页面移动方向。
 *
 * 首页位于最左侧的根层级，文章、手记及其他内容区依次向右；
 * 同层级的详情页沿用所属主分区，保证列表与详情之间的空间关系稳定。
 */
export function getNavigationTransitionType(
  currentPathname: string,
  targetPathname: string,
): NavigationTransitionType {
  const getSectionIndex = (pathname: string): number => {
    const sectionIndex = NAV_ITEMS.findIndex(item => (
      item.href === "/"
        ? pathname === "/"
        : (item.href && (pathname === item.href || pathname.startsWith(`${item.href}/`)))
          || item.children?.some(child => (
            child.href && (pathname === child.href || pathname.startsWith(`${child.href}/`))
          ))
    ));

    return sectionIndex >= 0 ? sectionIndex : 1;
  };

  return getSectionIndex(targetPathname) > getSectionIndex(currentPathname)
    ? "nav-forward"
    : "nav-back";
}
