import { Bot, Database, Gauge, ListChecks, Wrench } from "lucide-vue-next";
import { NTabPane, NTabs } from "naive-ui";
import { defineComponent } from "vue";

import { MeilisearchIndexesPanel } from "./indexes-panel";
import { MeilisearchMaintenancePanel } from "./maintenance-panel";
import { MeilisearchOverviewPanel } from "./overview-panel";
import { MeilisearchTasksPanel } from "./tasks-panel";
import { MeilisearchVectorConfigPanel } from "./vector-config-panel";

/** Meilisearch 管理功能入口页。 */
export default defineComponent({
  name: "MeilisearchManagementView",
  setup() {
    return () => (
      <div class="mx-auto p-5 max-w-screen-2xl space-y-5 md:p-8">
        <header>
          <h1 class="text-2xl font-semibold">Meilisearch 管理</h1>
          <p class="text-sm opacity-60 mt-1">
            管理索引、集合文档、搜索与向量配置，并维护增量同步和蓝绿重建任务。
          </p>
        </header>

        <NTabs type="line" animated>
          <NTabPane name="overview">
            {{
              tab: () => <span class="flex items-center gap-2"><Gauge class="size-4" />概览</span>,
              default: () => <MeilisearchOverviewPanel />,
            }}
          </NTabPane>
          <NTabPane name="indexes">
            {{
              tab: () => <span class="flex items-center gap-2"><Database class="size-4" />索引与文档</span>,
              default: () => <MeilisearchIndexesPanel />,
            }}
          </NTabPane>
          <NTabPane name="vector-config">
            {{
              tab: () => <span class="flex items-center gap-2"><Bot class="size-4" />项目向量配置</span>,
              default: () => <MeilisearchVectorConfigPanel />,
            }}
          </NTabPane>
          <NTabPane name="tasks">
            {{
              tab: () => <span class="flex items-center gap-2"><ListChecks class="size-4" />任务队列</span>,
              default: () => <MeilisearchTasksPanel />,
            }}
          </NTabPane>
          <NTabPane name="maintenance">
            {{
              tab: () => <span class="flex items-center gap-2"><Wrench class="size-4" />索引维护</span>,
              default: () => <MeilisearchMaintenancePanel />,
            }}
          </NTabPane>
        </NTabs>
      </div>
    );
  },
});
