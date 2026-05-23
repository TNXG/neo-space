import type { SerializedEditorState } from "lexical";
import type { PropType, VNode } from "vue";
import type { DraftHistoryListItem, DraftModel } from "~/models/draft";
import { computeDeltaStats } from "@haklex/rich-diff";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  Book as BookIcon,
  ChevronLeft,
  Code as CodeIcon,
  File as FileIcon,
  GitCompare,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-vue-next";
import {
  NButton,
  NEmpty,
  NPopconfirm,
  NScrollbar,
  NSpin,
  NTooltip,
} from "naive-ui";
import { storeToRefs } from "pinia";
import { computed, defineComponent, onBeforeUnmount, ref, watch } from "vue";

import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

import { draftsApi } from "~/api/drafts";
import { SplitPanel, useMasterDetailLayout } from "~/components/layout";
import { RelativeTime } from "~/components/time/relative-time";
import { DraftRefType } from "~/models/draft";
import { RouteName } from "~/router/name";
import { useUIStore } from "~/stores/ui";

function tryParseLexicalState(raw: string): SerializedEditorState | null {
  if (!raw?.trim())
    return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object")
      return null;
    const root = (v as { root?: unknown }).root;
    if (!root || typeof root !== "object")
      return null;
    const children = (root as { children?: unknown }).children;
    if (!Array.isArray(children))
      return null;
    return v as SerializedEditorState;
  } catch {
    return null;
  }
}

type DraftDiffStats
  = | {
    kind: "lexical";
    isSame: boolean;
    words: { added: number; removed: number };
  }
  | { kind: "text"; isSame: boolean; diff: number };

function computeDiffAgainstCurrent(
  historyText: string,
  historyRich: string,
  currentText: string,
  currentRich: string,
  contentFormat: DraftModel["contentFormat"] | undefined,
): DraftDiffStats | null {
  const useLexical
    = contentFormat === "lexical" && Boolean(historyRich && currentRich);

  if (useLexical) {
    const oldState = tryParseLexicalState(historyRich);
    const newState = tryParseLexicalState(currentRich);
    if (oldState && newState) {
      const stats = computeDeltaStats(oldState, newState);
      const isSame
        = stats.chars.added === 0
          && stats.chars.removed === 0
          && stats.words.added === 0
          && stats.words.removed === 0;
      return { kind: "lexical", isSame, words: stats.words };
    }
  }

  if (!historyText && !historyRich)
    return null;

  const diff = currentText.length - historyText.length;
  return {
    kind: "text",
    isSame: currentText === historyText,
    diff,
  };
}

export const refTypeConfig = {
  [DraftRefType.Post]: {
    label: "文章",
    icon: CodeIcon,
    editRoute: RouteName.EditPost,
  },
  [DraftRefType.Note]: {
    label: "手记",
    icon: BookIcon,
    editRoute: RouteName.EditNote,
  },
  [DraftRefType.Page]: {
    label: "页面",
    icon: FileIcon,
    editRoute: RouteName.EditPage,
  },
};

export interface VersionItem {
  version: number;
  title: string;
  savedAt: string;
  isCurrent: boolean;
  isFullSnapshot?: boolean;
  refVersion?: number;
  baseVersion?: number;
}

export interface DiffContentSlotProps {
  selectedText: string;
  selectedRichContent: string;
  currentText: string;
  currentRichContent: string;
  selectedVersion: number;
  currentVersion: number;
}

export const VersionListItem = defineComponent({
  name: "VersionListItem",
  props: {
    item: {
      type: Object as PropType<VersionItem>,
      required: true,
    },
    isSelected: {
      type: Boolean,
      default: false,
    },
    onClick: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onRestore: {
      type: Function as PropType<() => void>,
    },
    restoreLoading: {
      type: Boolean,
      default: false,
    },
    diffStats: {
      type: Object as PropType<DraftDiffStats | null | undefined>,
      default: undefined,
    },
  },
  setup(props) {
    const { isDark } = storeToRefs(useUIStore());
    const revertOverlayBg = computed(() => {
      if (props.isSelected) {
        return isDark.value
          ? "linear-gradient(90deg, transparent 0%, transparent 10%, rgb(10 10 10) 36%, rgb(10 10 10) 100%)"
          : "linear-gradient(90deg, transparent 0%, transparent 10%, rgb(212 212 212) 36%, rgb(212 212 212) 100%)";
      }
      return isDark.value
        ? "linear-gradient(90deg, transparent 0%, transparent 14%, rgb(10 10 10 / 0.55) 32%, rgb(10 10 10 / 0.97) 100%)"
        : "linear-gradient(90deg, transparent 0%, transparent 14%, rgb(235 235 235) 40%, rgb(235 235 235) 100%)";
    });

    return () => (
      <div
        class={[
          "group relative flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors",
          props.isSelected
            ? "bg-neutral-100 dark:bg-neutral-800"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/30",
        ]}
        onClick={props.onClick}
      >
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap gap-2 min-w-0 w-full items-center">
            <span class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
              v
              {props.item.version}
            </span>
            {props.item.isCurrent && (
              <span class="text-xs text-neutral-600 px-1.5 py-0.5 rounded bg-neutral-200 dark:text-neutral-300 dark:bg-neutral-700">
                当前
              </span>
            )}
            {props.item.isFullSnapshot !== undefined && (
              <span
                class={[
                  "rounded px-1.5 py-0.5 text-xs",
                  props.item.isFullSnapshot
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400",
                ]}
                title={
                  props.item.isFullSnapshot
                    ? "全量快照，存储完整内容"
                    : "增量存储，仅保存与上一全量版本的差异"
                }
              >
                {props.item.isFullSnapshot ? "全量" : "增量"}
              </span>
            )}
            {props.item.refVersion !== undefined && (
              <span
                class="text-xs text-purple-700 px-1.5 py-0.5 rounded bg-purple-100 dark:text-purple-400 dark:bg-purple-900/50"
                title={`内容与 v${props.item.refVersion} 相同，无需存储`}
              >
                = v
                {props.item.refVersion}
              </span>
            )}
            {props.item.baseVersion !== undefined
              && !props.item.isFullSnapshot && (
              <span
                class="text-xs text-neutral-600 px-1.5 py-0.5 rounded bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-700"
                title={`基于 v${props.item.baseVersion} 的增量`}
              >
                基于 v
                {props.item.baseVersion}
              </span>
            )}
            <span class="text-xs text-neutral-400 dark:text-neutral-500">
              <RelativeTime time={props.item.savedAt} />
            </span>
          </div>
          <p class="text-xs text-neutral-500 mt-0.5 truncate dark:text-neutral-400">
            {props.item.title || "无标题"}
          </p>
        </div>

        <div class="ml-auto flex shrink-0 min-h-6 min-w-0 items-center relative z-0">
          {props.diffStats != null && (
            <span class="text-xs text-right flex gap-1 whitespace-nowrap items-center justify-end tabular-nums">
              {props.diffStats.isSame
                ? (
                    <span class="text-neutral-500 dark:text-neutral-400">
                      与当前相同
                    </span>
                  )
                : props.diffStats.kind === "lexical"
                  ? (
                      <>
                        {props.diffStats.words.added > 0 && (
                          <span class="text-green-600 dark:text-green-400">
                            +
                            {props.diffStats.words.added}
                          </span>
                        )}
                        {props.diffStats.words.added > 0
                          && props.diffStats.words.removed > 0 && (
                          <span class="text-neutral-400">/</span>
                        )}
                        {props.diffStats.words.removed > 0 && (
                          <span class="text-red-600 dark:text-red-400">
                            -
                            {props.diffStats.words.removed}
                          </span>
                        )}
                        <span class="text-neutral-500 dark:text-neutral-400">词</span>
                      </>
                    )
                  : (
                      <>
                        <span
                          class={
                            props.diffStats.diff > 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }
                        >
                          {props.diffStats.diff > 0
                            ? `+${props.diffStats.diff}`
                            : props.diffStats.diff}
                          {" "}
                        </span>
                        <span class="text-neutral-500 dark:text-neutral-400">字</span>
                      </>
                    )}
            </span>
          )}
        </div>
        {!props.item.isCurrent && props.onRestore && (
          <>
            <div
              aria-hidden
              style={{ backgroundImage: revertOverlayBg.value }}
              class={[
                "pointer-events-none absolute bottom-0 right-0 top-0 z-[1] w-[6.25rem] opacity-0 transition-opacity duration-150",
                "group-hover:opacity-100",
              ]}
            />
            <div
              class={[
                "pointer-events-none absolute bottom-0 right-0 top-0 z-[2] flex items-center justify-end pr-2 opacity-0 transition-opacity duration-150",
                "group-hover:pointer-events-auto group-hover:opacity-100",
              ]}
            >
              <NPopconfirm
                positiveText="取消"
                negativeText="恢复"
                onNegativeClick={props.onRestore}
              >
                {{
                  trigger: () => (
                    <NTooltip>
                      {{
                        trigger: () => (
                          <NButton
                            size="tiny"
                            quaternary
                            loading={props.restoreLoading}
                            onClick={(e: MouseEvent) => e.stopPropagation()}
                          >
                            {{
                              icon: () => (
                                <RotateCcw class="text-neutral-500 h-3.5 w-3.5" />
                              ),
                            }}
                          </NButton>
                        ),
                        default: () => "恢复此版本",
                      }}
                    </NTooltip>
                  ),
                  default: () => (
                    <span>
                      确定要恢复到版本
                      {props.item.version}
                      ？
                    </span>
                  ),
                }}
              </NPopconfirm>
            </div>
          </>
        )}
      </div>
    );
  },
});

export const DraftDetailBase = defineComponent({
  name: "DraftDetailBase",
  props: {
    draft: {
      type: Object as PropType<DraftModel>,
      required: true,
    },
    isMobile: {
      type: Boolean,
      default: false,
    },
    onBack: {
      type: Function as PropType<() => void>,
    },
    onDelete: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
    diffContent: {
      type: Function as PropType<(props: DiffContentSlotProps) => VNode>,
      required: true,
    },
  },
  setup(props) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const config = computed(() => refTypeConfig[props.draft.refType]);
    const { isMobile: isInnerMobile } = useMasterDetailLayout();

    const showDiffPanel = ref(false);
    const selectedVersion = ref<number | null>(null);
    const selectedContent = ref<string>("");
    const selectedRichContent = ref<string>("");
    const isLoadingContent = ref(false);

    const versionContentCache = ref(
      new Map<number, { text: string; content?: string }>(),
    );
    const precomputedRowDiffs = ref(new Map<number, DraftDiffStats>());
    interface QueuedRowDiff { version: number; text: string; content: string }
    let diffQueue: QueuedRowDiff[] = [];
    let diffRafId: number | null = null;
    let prefetchGeneration = 0;

    const flushRowDiffQueue = () => {
      const BUDGET_MS = 8;
      const start = performance.now();
      const updates = new Map(precomputedRowDiffs.value);
      let dirty = false;

      while (diffQueue.length > 0 && performance.now() - start < BUDGET_MS) {
        const { version, text, content } = diffQueue.shift()!;
        const stats = computeDiffAgainstCurrent(
          text,
          content,
          props.draft.text,
          props.draft.content || "",
          props.draft.contentFormat,
        );
        if (stats) {
          updates.set(version, stats);
          dirty = true;
        }
      }

      if (dirty)
        precomputedRowDiffs.value = updates;
      if (diffQueue.length > 0) {
        diffRafId = requestAnimationFrame(flushRowDiffQueue);
      } else {
        diffRafId = null;
      }
    };

    const enqueueRowDiff = (version: number, text: string, content: string) => {
      diffQueue.push({ version, text, content });
      if (diffRafId === null) {
        diffRafId = requestAnimationFrame(flushRowDiffQueue);
      }
    };

    const cancelRowDiffBatch = () => {
      diffQueue = [];
      if (diffRafId !== null) {
        cancelAnimationFrame(diffRafId);
        diffRafId = null;
      }
    };

    onBeforeUnmount(cancelRowDiffBatch);

    const { data: historyData, isLoading: historyLoading } = useQuery({
      queryKey: ["drafts", "history", () => props.draft._id],
      queryFn: () => draftsApi.getHistory(props.draft._id),
      select: (res: any) =>
        Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [],
    });

    const versionList = computed<VersionItem[]>(() => {
      if (!historyData.value)
        return [];

      const sortedHistory = [
        ...(historyData.value as DraftHistoryListItem[]),
      ].sort((a, b) => b.version - a.version);

      return sortedHistory.map((item, index) => ({
        version: item.version,
        title: item.title,
        savedAt: item.savedAt,
        isCurrent: index === 0,
        isFullSnapshot: item.isFullSnapshot,
        refVersion: item.refVersion,
        baseVersion: item.baseVersion,
      }));
    });

    watch(
      [historyData, () => props.draft._id],
      () => {
        prefetchGeneration++;
        const gen = prefetchGeneration;
        cancelRowDiffBatch();
        precomputedRowDiffs.value = new Map();
        const cache = new Map<number, { text: string; content?: string }>();
        cache.set(props.draft.version, {
          text: props.draft.text,
          content: props.draft.content,
        });
        versionContentCache.value = cache;

        const list = historyData.value as DraftHistoryListItem[] | undefined;
        if (!list?.length)
          return;

        const sorted = [...list].sort((a, b) => b.version - a.version);
        const toFetch = sorted.filter(h => h.version !== props.draft.version);

        const CONCURRENCY = 3;
        let idx = 0;
        const fetchNext = async (): Promise<void> => {
          while (idx < toFetch.length) {
            if (gen !== prefetchGeneration)
              return;
            const item = toFetch[idx++];
            try {
              const data = await draftsApi.getHistoryVersion(
                props.draft._id,
                item.version,
              );
              if (gen !== prefetchGeneration)
                return;
              const entry = { text: data.text, content: data.content };
              const next = new Map(versionContentCache.value);
              next.set(item.version, entry);
              versionContentCache.value = next;
              enqueueRowDiff(item.version, entry.text, entry.content || "");
            } catch {
              // skip failed versions
            }
          }
        };

        void Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, toFetch.length) }, () =>
            fetchNext()),
        );
      },
      { immediate: true },
    );

    watch(
      [
        () => props.draft.text,
        () => props.draft.content,
        () => props.draft.contentFormat,
      ],
      () => {
        cancelRowDiffBatch();
        precomputedRowDiffs.value = new Map();
        const cache = versionContentCache.value;
        cache.set(props.draft.version, {
          text: props.draft.text,
          content: props.draft.content,
        });
        for (const [version, entry] of cache) {
          if (version === props.draft.version)
            continue;
          enqueueRowDiff(version, entry.text, entry.content || "");
        }
      },
    );

    const loadVersionContent = async (
      version: number,
    ): Promise<{ text: string; content?: string }> => {
      if (version === props.draft.version) {
        return { text: props.draft.text, content: props.draft.content };
      }

      const cached = versionContentCache.value.get(version);
      if (cached)
        return cached;

      try {
        const data = await draftsApi.getHistoryVersion(props.draft._id, version);
        const entry = { text: data.text, content: data.content };
        const next = new Map(versionContentCache.value);
        next.set(version, entry);
        versionContentCache.value = next;
        return entry;
      } catch (error) {
        console.error("Failed to load version:", error);
        return { text: "" };
      }
    };

    watch(
      [() => props.draft._id, versionList],
      async ([, list]) => {
        if (list.length >= 2) {
          const prevVersion = list[1];
          selectedVersion.value = prevVersion.version;

          isLoadingContent.value = true;
          const result = await loadVersionContent(prevVersion.version);
          selectedContent.value = result.text;
          selectedRichContent.value = result.content || "";
          isLoadingContent.value = false;
        } else {
          selectedVersion.value = null;
          selectedContent.value = "";
          selectedRichContent.value = "";
        }
      },
      { immediate: true },
    );

    const handleSelectVersion = async (version: number) => {
      if (selectedVersion.value === version) {
        if (isInnerMobile.value) {
          showDiffPanel.value = true;
        }
        return;
      }
      selectedVersion.value = version;
      isLoadingContent.value = true;
      const result = await loadVersionContent(version);
      selectedContent.value = result.text;
      selectedRichContent.value = result.content || "";
      isLoadingContent.value = false;

      if (isInnerMobile.value) {
        showDiffPanel.value = true;
      }
    };

    const handleBackToVersionList = () => {
      showDiffPanel.value = false;
    };

    const restoreMutation = useMutation({
      mutationFn: (version: number) =>
        draftsApi.restoreVersion(props.draft._id, version),
      onSuccess: () => {
        toast.success("版本已恢复");
        queryClient.invalidateQueries({ queryKey: ["drafts"] });
      },
      onError: () => {
        toast.error("恢复失败");
      },
    });

    const handleRestore = (version: number) => {
      restoreMutation.mutate(version);
    };

    const handleEdit = () => {
      router.push({
        name: config.value.editRoute,
        query: { draftId: props.draft._id },
      });
    };

    const diffStats = computed((): DraftDiffStats | null => {
      if (selectedVersion.value == null)
        return null;
      return computeDiffAgainstCurrent(
        selectedContent.value,
        selectedRichContent.value,
        props.draft.text,
        props.draft.content || "",
        props.draft.contentFormat,
      );
    });

    const currentVersion = computed(() => versionList.value[0]);
    const selectedVersionInfo = computed(() =>
      versionList.value.find(v => v.version === selectedVersion.value),
    );

    const renderVersionList = () => (
      <>
        <div class="px-4 py-2 border-b border-neutral-200 flex gap-2 items-center dark:border-neutral-800">
          <GitCompare class="text-neutral-500 size-4" />
          <span class="text-sm text-neutral-700 font-medium dark:text-neutral-300">
            版本列表
          </span>
          <span class="text-xs text-neutral-400">
            (
            {versionList.value.length}
            )
          </span>
        </div>
        <NScrollbar class="flex-1">
          <div>
            {versionList.value.map(item => (
              <VersionListItem
                key={item.version}
                item={item}
                isSelected={selectedVersion.value === item.version}
                diffStats={
                  item.isCurrent
                    ? undefined
                    : (precomputedRowDiffs.value.get(item.version)
                      ?? (selectedVersion.value === item.version
                        ? diffStats.value
                        : undefined))
                }
                onClick={() => handleSelectVersion(item.version)}
                onRestore={
                  item.isCurrent ? undefined : () => handleRestore(item.version)
                }
                restoreLoading={restoreMutation.isPending.value}
              />
            ))}
          </div>
        </NScrollbar>
      </>
    );

    const renderDiffHeader = (showBack: boolean) => (
      <div
        class={[
          "flex flex-shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-4 dark:border-neutral-800 dark:bg-neutral-900",
          showBack ? "py-2" : "h-10",
        ]}
      >
        <div class="flex gap-2 items-center">
          {showBack && (
            <NButton
              quaternary
              circle
              size="small"
              onClick={handleBackToVersionList}
            >
              {{
                icon: () => <ChevronLeft class="size-4" />,
              }}
            </NButton>
          )}
          <div class="text-xs text-neutral-600 flex gap-2 items-center dark:text-neutral-400">
            {selectedVersionInfo.value && (
              <>
                <span>
                  v
                  {selectedVersion.value}
                </span>
                <span class="text-neutral-400">→</span>
                <span>
                  v
                  {currentVersion.value?.version}
                  {" "}
                  (当前)
                </span>
              </>
            )}
          </div>
        </div>

        {diffStats.value && !diffStats.value.isSame && (
          <div class="text-xs text-neutral-500">
            {diffStats.value.kind === "lexical"
              ? (
                  <>
                    {diffStats.value.words.added > 0
                      ? `+${diffStats.value.words.added}`
                      : ""}
                    {diffStats.value.words.added > 0
                      && diffStats.value.words.removed > 0
                      ? " / "
                      : ""}
                    {diffStats.value.words.removed > 0
                      ? `-${diffStats.value.words.removed}`
                      : ""}
                    {" "}
                    词
                  </>
                )
              : (
                  <>
                    {diffStats.value.diff > 0
                      ? `+${diffStats.value.diff}`
                      : diffStats.value.diff}
                    {" "}
                    字
                  </>
                )}
          </div>
        )}
      </div>
    );

    const renderDiffContent = (desktopEmpty: boolean) => {
      if (isLoadingContent.value) {
        return (
          <div class="flex h-full items-center justify-center">
            <NSpin />
          </div>
        );
      }

      if (desktopEmpty && !selectedVersion.value) {
        return (
          <div class="border border-neutral-300 border-dashed bg-white flex flex-col gap-3 h-full items-center justify-center dark:border-neutral-700 dark:bg-neutral-900">
            <div class="rounded-full bg-neutral-100 flex size-12 items-center justify-center dark:bg-neutral-800">
              <GitCompare class="text-neutral-500 size-6 dark:text-neutral-400" />
            </div>
            <p class="text-sm text-neutral-500 dark:text-neutral-400">
              选择一个历史版本查看差异
            </p>
          </div>
        );
      }

      if (diffStats.value?.isSame) {
        return (
          <div class="flex flex-col gap-3 h-full items-center justify-center">
            <div class="rounded-full bg-neutral-100 flex size-12 items-center justify-center dark:bg-neutral-800">
              <GitCompare class="text-neutral-500 size-6 dark:text-neutral-400" />
            </div>
            <div class="text-center">
              <p class="text-sm text-neutral-700 font-medium dark:text-neutral-300">
                与当前版本内容相同
              </p>
              {desktopEmpty && (
                <p class="text-xs text-neutral-500 mt-1 dark:text-neutral-400">
                  选择其他版本进行对比
                </p>
              )}
            </div>
          </div>
        );
      }

      if (
        (selectedContent.value || selectedRichContent.value)
        && selectedVersion.value
        && currentVersion.value
      ) {
        return (
          <div class="h-full overflow-hidden">
            {props.diffContent({
              selectedText: selectedContent.value,
              selectedRichContent: selectedRichContent.value,
              currentText: props.draft.text,
              currentRichContent: props.draft.content || "",
              selectedVersion: selectedVersion.value,
              currentVersion: currentVersion.value.version,
            })}
          </div>
        );
      }

      return (
        <div
          class={[
            "flex h-full flex-col items-center justify-center gap-3 p-4",
            desktopEmpty
              ? "rounded-lg border border-dashed border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900"
              : "bg-white dark:bg-neutral-900",
          ]}
        >
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            无法加载版本内容
          </p>
        </div>
      );
    };

    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 py-3 border-b border-neutral-200 bg-white flex flex-shrink-0 h-12 items-center justify-between dark:border-neutral-800 dark:bg-neutral-900">
          <div class="flex gap-3 items-center">
            {props.isMobile && props.onBack && (
              <NButton quaternary circle size="small" onClick={props.onBack}>
                {{
                  icon: () => <ChevronLeft class="size-4" />,
                }}
              </NButton>
            )}
            <div class="flex flex-col">
              <h3 class="text-base text-neutral-900 font-semibold dark:text-neutral-100">
                {props.draft.title || "无标题"}
              </h3>
              <div class="text-xs text-neutral-500 flex gap-2 items-center dark:text-neutral-400">
                <span>{config.value.label}</span>
                <span>·</span>
                <span>
                  v
                  {props.draft.version}
                </span>
                <span>·</span>
                <RelativeTime time={props.draft.updatedAt} />
              </div>
            </div>
          </div>

          <div class="flex gap-2 items-center">
            <NButton size="small" onClick={handleEdit}>
              {{
                icon: () => <Pencil class="h-3.5 w-3.5" />,
                default: () => "编辑",
              }}
            </NButton>
            <NPopconfirm
              positiveText="取消"
              negativeText="删除"
              onNegativeClick={() => props.onDelete(props.draft._id)}
            >
              {{
                trigger: () => (
                  <NButton size="small" quaternary>
                    {{
                      icon: () => <Trash2 class="text-red-500 h-3.5 w-3.5" />,
                    }}
                  </NButton>
                ),
                default: () => (
                  <span class="max-w-48">
                    确定要删除草稿「
                    {props.draft.title || "无标题"}
                    」？
                  </span>
                ),
              }}
            </NPopconfirm>
          </div>
        </div>

        <div class="flex-1 min-h-0">
          {historyLoading.value
            ? (
                <div class="flex h-full items-center justify-center">
                  <NSpin size="large" />
                </div>
              )
            : versionList.value.length === 0
              ? (
                  <div class="flex h-full items-center justify-center">
                    <NEmpty description="暂无历史版本" />
                  </div>
                )
              : isInnerMobile.value
                ? (
                    <div class="h-full w-full relative overflow-hidden">
                      <div
                        class={[
                          "absolute inset-0 w-full transition-transform duration-300",
                          showDiffPanel.value && "-translate-x-full",
                        ]}
                      >
                        <div class="bg-white flex flex-col h-full dark:bg-neutral-900">
                          {renderVersionList()}
                        </div>
                      </div>

                      <div
                        class={[
                          "absolute inset-0 w-full transition-transform duration-300",
                          !showDiffPanel.value && "translate-x-full",
                        ]}
                      >
                        <div class="bg-neutral-50 flex flex-col h-full dark:bg-neutral-950">
                          {renderDiffHeader(true)}
                          <div class="flex-1 min-h-0 overflow-hidden">
                            {renderDiffContent(false)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                : (
                    <SplitPanel
                      direction="horizontal"
                      defaultSize="300px"
                      min="200px"
                      max="300px"
                      resizeTriggerClass="z-[10]"
                      class="h-full"
                    >
                      <div class="bg-white flex flex-col h-full dark:bg-neutral-900">
                        {renderVersionList()}
                      </div>
                      <div class="bg-neutral-50 flex flex-col h-full dark:bg-neutral-950">
                        {renderDiffHeader(false)}
                        <div class="flex-1 min-h-0 overflow-hidden">
                          {renderDiffContent(true)}
                        </div>
                      </div>
                    </SplitPanel>
                  )}
        </div>
      </div>
    );
  },
});
