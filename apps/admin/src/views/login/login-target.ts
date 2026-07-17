/** 只允许登录后返回站内受保护页面，拒绝嵌套登录和外部跳转。 */
export const resolvePostLoginTarget = (from: unknown): string => {
  if (typeof from !== "string")
    return "/dashboard";
  let target: string;
  try {
    target = decodeURIComponent(from);
  } catch {
    return "/dashboard";
  }
  if (
    !target.startsWith("/")
    || target.startsWith("//")
    || target.startsWith("/login")
    || target.startsWith("/auth/callback")
  ) {
    return "/dashboard";
  }
  return target;
};
