import type { SettingGroup } from "./settings-schema";

/** 出站 HTTP 代理只存于 Owner 配置，永不经公开站点信息返回。 */
export const networkGroup: SettingGroup = {
  key: "networkOptions",
  slug: "network",
  title: "网络代理",
  icon: "mingcute:earth-line",
  help: "当服务器难以直接访问海外或外部服务（如 GitHub 登录、AI 接口、友链检测）时，可通过代理连接。",
  sections: [{
    title: "代理服务器",
    icon: "mingcute:earth-line",
    help: "支持 HTTP、HTTPS 与 SOCKS5 协议；支持代理认证。保存后重启后端服务即可生效。",
    fields: [{
      path: "proxyUrl",
      label: "代理地址",
      control: "text",
      placeholder: "http://127.0.0.1:7890 或 socks5://127.0.0.1:1080",
      hint: "只填写协议、主机和端口；用户名与密码在下方单独填写。留空则直接连接网络。后端设置 NETWORK_PROXY_URL 时以环境变量为准，此处仅作回退。",
    }],
  }],
};
