import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./router", async () => {
  const { createMemoryHistory, createRouter } = await import("vue-router");
  return {
    router: createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/login", component: {}, meta: { isPublic: true, title: "登录" } },
        ...["博文", "手记", "页面"].map((title, index) => ({
          path: `/module-${index}`,
          component: {},
          meta: { isPublic: true, title },
          children: [{ path: "list", component: {}, meta: { title: "管理" } }],
        })),
        { path: "/untitled", component: {}, meta: { isPublic: true } },
        { path: "/blank", component: {}, meta: { isPublic: true, title: "  " } },
      ],
    }),
  };
});

vi.mock("~/api/user", () => ({ userApi: { checkLogged: vi.fn() } }));

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("VITE_APP_TITLE", "");
  setActivePinia(createPinia());
  document.title = "previous page";
});

describe("navigation titles", () => {
  it.each([
    ["/login", "登录 | Neo Space 管理后台"],
    ["/module-0/list", "博文 · 管理 | Neo Space 管理后台"],
    ["/module-1/list", "手记 · 管理 | Neo Space 管理后台"],
    ["/module-2/list", "页面 · 管理 | Neo Space 管理后台"],
    ["/untitled", "Neo Space 管理后台"],
    ["/blank", "Neo Space 管理后台"],
  ])("sets the title after navigating to %s", async (path, title) => {
    const { router } = await import("./router");
    await import("./guard");
    await router.push(path);
    expect(document.title).toBe(title);
  });

  it("keeps a trimmed custom admin name across navigation", async () => {
    vi.stubEnv("VITE_APP_TITLE", "  自定义后台  ");
    const { router } = await import("./router");
    await import("./guard");
    await router.push("/module-0/list");
    expect(document.title).toBe("博文 · 管理 | 自定义后台");
    await router.push("/login");
    expect(document.title).toBe("登录 | 自定义后台");
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});
