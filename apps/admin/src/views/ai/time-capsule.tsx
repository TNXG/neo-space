import type { TimeCapsuleContent, TimeCapsuleContentType } from "~/api/ai";
import { useQuery } from "@tanstack/vue-query";
import { computed, defineComponent, ref } from "vue";

import { aiApi } from "~/api/ai";
import { MasterDetailLayout, useMasterDetailLayout } from "~/components/layout";
import { queryKeys } from "~/hooks/queries/keys";

import { TimeCapsuleDetail } from "./components/time-capsule-detail";
import { TimeCapsuleList } from "./components/time-capsule-list";

export default defineComponent({
  name: "AITimeCapsulePage",
  setup() {
    const { isMobile } = useMasterDetailLayout();
    const page = ref(1);
    const search = ref("");
    const contentType = ref<TimeCapsuleContentType | null>(null);
    const selectedId = ref<string | null>(null);
    const showDetailOnMobile = ref(false);
    const queryParams = computed(() => ({
      page: page.value,
      size: 30,
      ...(search.value ? { search: search.value } : {}),
      ...(contentType.value ? { type: contentType.value } : {}),
    }));

    const { data, isPending, refetch } = useQuery({
      queryKey: computed(() => queryKeys.ai.timeCapsulesList(queryParams.value)),
      queryFn: () => aiApi.getTimeCapsuleContents(queryParams.value),
    });

    const selectedContent = computed<TimeCapsuleContent | null>(() =>
      data.value?.items.find(item => item._id === selectedId.value) ?? null,
    );

    const handleSelect = (content: TimeCapsuleContent) => {
      selectedId.value = content._id;
      if (isMobile.value)
        showDetailOnMobile.value = true;
    };

    const resetSelection = () => {
      selectedId.value = null;
      showDetailOnMobile.value = false;
    };

    return () => (
      <MasterDetailLayout
        showDetailOnMobile={showDetailOnMobile.value}
        defaultSize="380px"
        min="320px"
        max="460px"
      >
        {{
          list: () => (
            <TimeCapsuleList
              items={data.value?.items ?? []}
              pagination={data.value?.pagination ?? null}
              loading={isPending.value}
              selectedId={selectedId.value}
              search={search.value}
              contentType={contentType.value}
              onSelect={handleSelect}
              onPageChange={(value) => {
                page.value = value;
                resetSelection();
              }}
              onSearchChange={(value) => {
                search.value = value;
                page.value = 1;
                resetSelection();
              }}
              onTypeChange={(value) => {
                contentType.value = value;
                page.value = 1;
                resetSelection();
              }}
            />
          ),
          detail: () => selectedContent.value
            ? (
                <TimeCapsuleDetail
                  content={selectedContent.value}
                  isMobile={isMobile.value}
                  onBack={() => (showDetailOnMobile.value = false)}
                  onRefresh={() => refetch()}
                />
              )
            : null,
          empty: () => (
            <div class="text-neutral-500 flex h-full flex-col items-center justify-center dark:text-neutral-400">
              <p class="text-sm">选择一篇内容查看时光胶囊</p>
            </div>
          ),
        }}
      </MasterDetailLayout>
    );
  },
});
