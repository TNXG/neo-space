/** 可编辑的代理字段；后端仍以包含凭据的单个 proxyUrl 保存。 */
export interface ProxyParts {
  address: string;
  username: string;
  password: string;
}

const ABSOLUTE_URL = /^[a-z][a-z0-9+.-]*:\/\//i;

/** 只接受带协议的完整地址，避免把 `localhost:7890` 误判为自定义协议。 */
export function parseProxyUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!ABSOLUTE_URL.test(trimmed)) return null;
  try {
    return new URL(trimmed);
  } catch {
    return null;
  }
}

/** 无效百分号编码保留原文，交给后端校验，不在前端静默改写。 */
function decodeCredential(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** 将已保存的 proxyUrl 拆成可分别编辑的字段；无法解析时原样保留地址。 */
export function splitProxyUrl(proxyUrl: string): ProxyParts {
  const url = parseProxyUrl(proxyUrl);
  if (!url) return { address: proxyUrl, username: "", password: "" };
  const path = url.pathname === "/" ? "" : url.pathname;
  return {
    address: `${url.protocol}//${url.host}${path}${url.search}${url.hash}`,
    username: decodeCredential(url.username),
    password: decodeCredential(url.password),
  };
}

/** 重新组合后端的单个 proxyUrl；凭据按 userinfo 规则百分号编码。 */
export function composeProxyUrl(parts: ProxyParts): string {
  const address = parts.address.trim();
  if (!address) return "";
  const url = parseProxyUrl(address);
  if (!url) return address;
  // 没有凭据时保留用户输入原文，避免在输入端口等中间状态时被 URL 规范化改写。
  if (!parts.username && !parts.password) return address;
  const credentials = `${encodeURIComponent(parts.username)}${parts.password ? `:${encodeURIComponent(parts.password)}` : ""}@`;
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${url.protocol}//${credentials}${url.host}${path}${url.search}${url.hash}`;
}

/** 新地址内嵌凭据时替换独立字段，否则只改地址并保留已有凭据。 */
export function updateProxyAddress(value: string, current: ProxyParts): ProxyParts {
  const url = parseProxyUrl(value);
  if (url && (url.username || url.password)) {
    const parsed = splitProxyUrl(value);
    return { address: parsed.address, username: parsed.username, password: parsed.password };
  }
  return { ...current, address: value };
}
