import { Elysia, t } from "elysia";
import { responsePlugin } from "@/plugins/response";

/**
 * nbnhhsh 工具路由
 *
 * 提供缩写翻译服务的代理接口
 * - POST /nbnhhsh/guess - 猜测缩写含义
 */
export const nbnhhshRoutes = new Elysia({ prefix: "/nbnhhsh" })
  .use(responsePlugin())

  // POST /nbnhhsh/guess - 猜测缩写
  .post(
    "/guess",
    async ({ body, success, error, set }) => {
      try {
        // 调用 nbnhhsh API
        const response = await fetch("https://lab.magiconch.com/api/nbnhhsh/guess", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: body.text }),
        });

        if (!response.ok) {
          set.status = 500;
          return error(500, "Failed to fetch from nbnhhsh API");
        }

        const data = await response.json();
        return success(data);
      } catch (err) {
        console.error("Error calling nbnhhsh API:", err);
        set.status = 500;
        return error(500, "Failed to guess abbreviation");
      }
    },
    {
      body: t.Object({
        text: t.String(),
      }),
    },
  );
