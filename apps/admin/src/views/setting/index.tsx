import type { OptionValue, SystemOptions } from "~/api/options";
import { isEqual } from "es-toolkit/compat";
import { RefreshCw as RefreshIcon, Settings as SettingsIcon } from "lucide-vue-next";
import { NButton, NEmpty, NSkeleton } from "naive-ui";
import { computed, defineComponent, onBeforeMount, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";

import { optionsApi } from "~/api/options";
import { MasterDetailLayout, useMasterDetailLayout } from "~/components/layout";
import { useLayout } from "~/hooks/use-layout";
import { SettingsDetailPanel } from "~/layouts/settings-layout";

import { SettingListPanel } from "./components/SettingListPanel";
import { getOptionMetadata } from "./option-metadata";
import { TabSystem } from "./tabs/system";
import { TabUser } from "./tabs/user";

const staticGroupTitles: Record<string, string> = {
  user: "用户",
};

const staticComponentMap: Record<string, ReturnType<typeof defineComponent>> = {
  user: TabUser,
};

export default defineComponent({
  setup() {
    const route = useRoute();
    const router = useRouter();
    const { setActions } = useLayout();
    const { isMobile } = useMasterDetailLayout();
    const options = ref<SystemOptions | null>(null);
    const isLoading = ref(false);
    const loadError = ref("");
    const showDetailOnMobile = ref(false);

    const loadOptions = async () => {
      isLoading.value = true;
      loadError.value = "";
      try {
        const nextOptions = await optionsApi.getAll();
        if (!isEqual(options.value, nextOptions)) {
          options.value = nextOptions;
        }
      } catch (error: unknown) {
        loadError.value = error instanceof Error ? error.message : "配置加载失败";
      } finally {
        isLoading.value = false;
      }
    };

    onBeforeMount(() => void loadOptions());

    const activeGroupKey = computed(() => {
      const groupKey = typeof route.query.group === "string" ? route.query.group : "user";
      if (!options.value && groupKey !== "user") {
        return groupKey;
      }
      if (groupKey in staticComponentMap || Object.hasOwn(options.value ?? {}, groupKey)) {
        return groupKey;
      }
      return "user";
    });

    const isOptionGroup = computed(() => Boolean(options.value && activeGroupKey.value in options.value));
    const activeTitle = computed(() => {
      if (isOptionGroup.value) {
        return getOptionMetadata(activeGroupKey.value).title;
      }
      return staticGroupTitles[activeGroupKey.value] ?? "设置";
    });

    const handleGroupChange = (groupKey: string) => {
      router.replace({ name: route.name as string, query: { group: groupKey } });
      if (isMobile.value) {
        showDetailOnMobile.value = true;
      }
    };

    const handleOptionSaved = (value: OptionValue) => {
      if (!options.value) {
        return;
      }
      options.value = { ...options.value, [activeGroupKey.value]: value };
    };

    setActions(
      <NButton size="small" onClick={() => void loadOptions()} renderIcon={() => <RefreshIcon size={15} />}>
        刷新配置
      </NButton>,
    );

    onUnmounted(() => {
      setActions(null);
    });

    const EmptyState = () => (
      <div class="text-center bg-neutral-50 flex flex-col h-full items-center justify-center dark:bg-neutral-950">
        <div class="mb-4 rounded-full bg-neutral-100 flex size-16 items-center justify-center dark:bg-neutral-800">
          <SettingsIcon class="text-neutral-400 size-8" />
        </div>
        <h3 class="text-base text-neutral-900 font-medium mb-1 dark:text-neutral-100">选择一个设置项</h3>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">从左侧列表选择查看详情</p>
      </div>
    );

    const DetailContent = () => {
      const StaticComponent = staticComponentMap[activeGroupKey.value];
      return (
        <SettingsDetailPanel title={activeTitle.value} onBack={() => { showDetailOnMobile.value = false; }}>
          {isLoading.value && !options.value
            ? <div class="py-8 space-y-6"><NSkeleton text repeat={2} /><NSkeleton height="220px" /><NSkeleton height="40px" width="180px" /></div>
            : loadError.value && !options.value
              ? (
                  <NEmpty description={loadError.value}>
                    {{ extra: () => <NButton onClick={() => void loadOptions()}>重新加载</NButton> }}
                  </NEmpty>
                )
              : isOptionGroup.value && options.value
                ? <TabSystem optionKey={activeGroupKey.value} value={options.value[activeGroupKey.value]} onSaved={handleOptionSaved} />
                : StaticComponent && <StaticComponent />}
        </SettingsDetailPanel>
      );
    };

    return () => (
      <MasterDetailLayout showDetailOnMobile={showDetailOnMobile.value} defaultSize="250px" min="200px" max="400px">
        {{
          list: () => <SettingListPanel activeGroupKey={activeGroupKey.value} options={options.value} loading={isLoading.value} onGroupChange={handleGroupChange} />,
          detail: () => <DetailContent />,
          empty: () => <EmptyState />,
        }}
      </MasterDetailLayout>
    );
  },
});
