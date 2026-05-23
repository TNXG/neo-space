import type { TableColumns } from "naive-ui/lib/data-table/src/interface";
import type { PropType } from "vue";
import type { NoteModel } from "~/models/note";
import { useMutation, useQueryClient } from "@tanstack/vue-query";
import { debouncedRef } from "@vueuse/core";
import {
  Book as BookIcon,
  Bookmark as BookmarkIcon,
  ExternalLink,
  EyeOff as EyeHideIcon,
  Heart as HeartIcon,
  MapPin,
  Pencil,
  Plus as PlusIcon,
  Search as SearchIcon,
  Trash2,
} from "lucide-vue-next";
import { NButton, NEllipsis, NInput, NPopconfirm, NSpace } from "naive-ui";
import { computed, defineComponent, reactive, ref, watchEffect } from "vue";

import { RouterLink } from "vue-router";
import { toast } from "vue-sonner";

import { notesApi } from "~/api/notes";
import { searchApi } from "~/api/search";
import { TableTitleLink } from "~/components/link/title-link";
import { DeleteConfirmButton } from "~/components/special-button/delete-confirm";
import { StatusToggle } from "~/components/status-toggle";
import { Table } from "~/components/table";
import { EditColumn } from "~/components/table/edit-column";
import { RelativeTime } from "~/components/time/relative-time";
import { WEB_URL } from "~/constants/env";
import { queryKeys } from "~/hooks/queries/keys";
import { useDataTable } from "~/hooks/use-data-table";
import { useStoreRef } from "~/hooks/use-store-ref";
import { UIStore } from "~/stores/ui";
import { formatNumber } from "~/utils/number";

import { HeaderActionButton } from "../../components/button/header-action-button";
import { useLayout } from "../../layouts/content";

const buildNotePublicPath = (
  note: Pick<NoteModel, "nid" | "slug" | "createdAt">,
) => {
  if (note.slug) {
    const date = new Date(note.createdAt);
    return `/notes/${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}/${note.slug}`;
  }

  return `/notes/${note.nid}`;
};

const NoteItem = defineComponent({
  name: "NoteItem",
  props: {
    data: {
      type: Object as PropType<NoteModel>,
      required: true,
    },
    onDelete: {
      type: Function as PropType<(_id: string) => void>,
      required: true,
    },
  },
  setup(props) {
    const row = computed(() => props.data);
    const isSecret = computed(
      () =>
        row.value.publicAt && +new Date(row.value.publicAt) - Date.now() > 0,
    );
    const isUnpublished = computed(() => !row.value.isPublished);

    return () => (
      <div class="px-3 py-2.5 border-b border-neutral-200 flex gap-2 transition-colors items-center last:border-b-0 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900/50">
        <div class="flex-1 min-w-0">
          <div class="flex gap-1.5 items-center">
            <span class="text-xs text-neutral-400 font-mono shrink-0 dark:text-neutral-500">
              #
              {row.value.nid}
            </span>
            {(isUnpublished.value || isSecret.value) && (
              <EyeHideIcon class="text-neutral-500 shrink-0 h-3 w-3" />
            )}
            {row.value.bookmark && (
              <BookmarkIcon class="text-red-500 shrink-0 h-3 w-3" />
            )}
            <RouterLink
              to={`/notes/edit?id=${row.value._id}`}
              class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100 hover:text-blue-600 dark:hover:text-blue-400"
            >
              {row.value.title}
            </RouterLink>
          </div>

          <div class="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 items-center">
            {row.value.mood && (
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                {row.value.mood}
              </span>
            )}
            {row.value.weather && (
              <span class="text-xs text-neutral-500 dark:text-neutral-400">
                {row.value.weather}
              </span>
            )}
            {row.value.location && (
              <span class="text-xs text-neutral-400 flex gap-0.5 max-w-20 truncate items-center dark:text-neutral-500">
                <MapPin class="shrink-0 h-2.5 w-2.5" />
                {row.value.location}
              </span>
            )}
            <span class="text-xs text-neutral-400 font-mono dark:text-neutral-500">
              {row.value.slug || "—"}
            </span>
            <span class="text-xs text-neutral-400 flex gap-0.5 items-center dark:text-neutral-500">
              <BookIcon class="h-2.5 w-2.5" />
              {formatNumber(row.value.readCount || 0)}
            </span>
            <span class="text-xs text-neutral-400 flex gap-0.5 items-center dark:text-neutral-500">
              <HeartIcon class="h-2.5 w-2.5" />
              {formatNumber(row.value.likeCount || 0)}
            </span>
            <span class="text-xs text-neutral-400 dark:text-neutral-500">
              ·
            </span>
            <RelativeTime
              time={row.value.createdAt}
              class="text-xs text-neutral-400 dark:text-neutral-500"
            />
            <StatusToggle
              isPublished={row.value.isPublished ?? false}
              size="small"
            />
          </div>
        </div>

        <div class="flex shrink-0 items-center">
          <a
            href={`${WEB_URL}${buildNotePublicPath(row.value)}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="在新窗口打开日记"
          >
            <NButton quaternary size="tiny" class="!px-1.5">
              {{
                icon: () => (
                  <ExternalLink class="text-neutral-500 h-3.5 w-3.5" />
                ),
              }}
            </NButton>
          </a>

          <RouterLink
            to={`/notes/edit?id=${row.value._id}`}
            aria-label="编辑日记"
          >
            <NButton quaternary size="tiny" class="!px-1.5">
              {{
                icon: () => <Pencil class="text-neutral-500 h-3.5 w-3.5" />,
              }}
            </NButton>
          </RouterLink>

          <NPopconfirm
            positiveText="取消"
            negativeText="删除"
            onNegativeClick={() => props.onDelete(row.value._id)}
          >
            {{
              trigger: () => (
                <NButton
                  quaternary
                  size="tiny"
                  class="!px-1.5"
                  aria-label="删除日记"
                >
                  {{
                    icon: () => <Trash2 class="text-red-500 h-3.5 w-3.5" />,
                  }}
                </NButton>
              ),
              default: () => (
                <span class="max-w-48">
                  确定要删除「
                  {row.value.title}
                  」？
                </span>
              ),
            }}
          </NPopconfirm>
        </div>
      </div>
    );
  },
});

export const ManageNoteListView = defineComponent({
  name: "NoteList",
  setup() {
    const queryClient = useQueryClient();
    const ui = useStoreRef(UIStore);
    const isMobile = computed(
      () => ui.viewport.value.mobile || ui.viewport.value.pad,
    );

    const searchKeyword = ref("");
    const debouncedSearch = debouncedRef(searchKeyword, 300);
    const dbQuery = ref<Record<string, boolean> | undefined>(undefined);

    const {
      isLoading: loading,
      checkedRowKeys,
      data,
      pager,
      refresh,
      setSort,
      setPage,
    } = useDataTable<NoteModel>({
      queryKey: params =>
        queryKeys.notes.list({ ...params, dbQuery: params.filters?.dbQuery }),
      queryFn: (params) => {
        const keyword = params.filters?.search;
        if (keyword) {
          return searchApi.searchNotes({
            keyword,
            page: params.page,
            size: params.size,
          }) as Promise<any>;
        }
        return notesApi.getList({
          page: params.page,
          size: params.size,
          select:
            "title nid _id slug created modified mood weather publicAt bookmark coordinates location count meta isPublished",
          sortBy: params.sortBy || undefined,
          sortOrder: params.sortOrder || undefined,
          db_query: params.filters?.dbQuery,
        }) as Promise<any>;
      },
      pageSize: 20,
      filters: () => ({
        dbQuery: dbQuery.value,
        search: debouncedSearch.value || undefined,
      }),
    });

    const deleteMutation = useMutation({
      mutationFn: notesApi.delete,
      onSuccess: () => {
        toast.success("删除成功");
        queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
      },
    });

    const patchMutation = useMutation({
      mutationFn: ({ _id, data }: { _id: string; data: Partial<NoteModel> }) =>
        notesApi.patch(_id, data),
    });

    const handleDelete = (_id: string) => {
      deleteMutation.mutate(_id);
    };

    const CardList = defineComponent({
      setup() {
        return () => (
          <div class="border border-neutral-200 rounded-lg bg-white overflow-hidden dark:border-neutral-800 dark:bg-neutral-900">
            {loading.value
              ? (
                  <div class="py-16 flex items-center justify-center">
                    <span class="text-sm text-neutral-400">加载中…</span>
                  </div>
                )
              : data.value.length === 0
                ? (
                    <div class="py-16 flex flex-col items-center justify-center">
                      <p class="text-sm text-neutral-500 dark:text-neutral-400">
                        暂无日记
                      </p>
                      <RouterLink
                        to="/notes/edit"
                        class="text-sm text-blue-500 mt-4 hover:text-blue-600 hover:underline"
                      >
                        记录第一篇日记
                      </RouterLink>
                    </div>
                  )
                : (
                    <div>
                      {data.value.map(item => (
                        <NoteItem key={item._id} data={item} onDelete={handleDelete} />
                      ))}
                    </div>
                  )}

            {pager.value && pager.value.totalPage > 1 && (
              <div class="py-4 border-t border-neutral-200 flex gap-4 items-center justify-center dark:border-neutral-800">
                <button
                  class="text-sm px-3 py-1.5 border border-neutral-200 rounded-md dark:border-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-neutral-800"
                  disabled={!pager.value.hasPrevPage}
                  onClick={() => {
                    if (pager.value?.hasPrevPage) {
                      setPage(pager.value.currentPage - 1);
                    }
                  }}
                >
                  上一页
                </button>
                <span class="text-sm text-neutral-500 dark:text-neutral-400">
                  {pager.value.currentPage}
                  {" "}
                  /
                  {pager.value.totalPage}
                </span>
                <button
                  class="text-sm px-3 py-1.5 border border-neutral-200 rounded-md dark:border-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed dark:hover:bg-neutral-800"
                  disabled={!pager.value.hasNextPage}
                  onClick={() => {
                    if (pager.value?.hasNextPage) {
                      setPage(pager.value.currentPage + 1);
                    }
                  }}
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        );
      },
    });

    const DataTable = defineComponent({
      setup() {
        const columns = reactive<TableColumns<NoteModel>>([
          {
            type: "selection",
            fixed: "left",
            options: ["none", "all"],
          },
          {
            title: "序号",
            width: 16 * 4,
            key: "nid",
            fixed: "left",
          },
          {
            title: "标题",
            sortOrder: false,
            sorter: "default",
            key: "title",
            width: 280,
            fixed: "left",

            filter: true,
            filterOptions: [
              { label: "回忆项", value: "bookmark" },
              { label: "草稿项", value: "unpublished" },
            ],

            render(row) {
              const isSecret = Boolean(
                row.publicAt && +new Date(row.publicAt) - Date.now() > 0,
              );
              const isUnpublished = !row.isPublished;
              return (
                <TableTitleLink
                  inPageTo={`/notes/edit?id=${row._id}`}
                  title={row.title}
                  externalLinkTo={buildNotePublicPath(row)}
                  id={row._id}
                  withToken={isUnpublished || isSecret}
                >
                  {{
                    default() {
                      return (
                        <>
                          {isUnpublished || isSecret
                            ? (
                                <EyeHideIcon class="text-neutral-500 h-3.5 w-3.5" />
                              )
                            : null}
                          {row.bookmark
                            ? (
                                <BookmarkIcon class="text-red-500 h-3.5 w-3.5" />
                              )
                            : null}
                        </>
                      );
                    },
                  }}
                </TableTitleLink>
              );
            },
          },
          {
            title: "心情",
            key: "mood",
            width: 100,
            render(row, index) {
              return (
                <EditColumn
                  initialValue={data.value[index]?.mood ?? ""}
                  onSubmit={async (v) => {
                    await patchMutation.mutateAsync({
                      _id: row._id,
                      data: { mood: v },
                    });
                    toast.success("修改成功");
                  }}
                  placeholder="心情"
                />
              );
            },
          },
          {
            title: "Slug",
            key: "slug",
            width: 220,
            render(row) {
              return <span class="text-xs font-mono">{row.slug || "—"}</span>;
            },
          },
          {
            title: "天气",
            key: "weather",
            width: 100,
            render(row, index) {
              return (
                <EditColumn
                  initialValue={data.value[index]?.weather ?? ""}
                  onSubmit={async (v) => {
                    await patchMutation.mutateAsync({
                      _id: row._id,
                      data: { weather: v },
                    });
                    toast.success("修改成功");
                  }}
                  placeholder="天气"
                />
              );
            },
          },
          {
            title: "地点",
            key: "location",
            width: 200,
            render(row) {
              const { coordinates, location } = row;
              if (!location)
                return null;

              return (
                <NEllipsis class="max-w-[200px] truncate">
                  {{
                    tooltip() {
                      return (
                        <div>
                          <p>{location}</p>
                          <p>
                            {coordinates?.longitude}
                            ,
                            {coordinates?.latitude}
                          </p>
                        </div>
                      );
                    },
                    default() {
                      return location;
                    },
                  }}
                </NEllipsis>
              );
            },
          },

          {
            title: () => <BookIcon class="h-4 w-4" />,
            key: "readCount",
            width: 50,
            ellipsis: {
              tooltip: true,
            },
            render(row) {
              return formatNumber(row.readCount || 0);
            },
          },
          {
            title: () => <HeartIcon class="h-4 w-4" />,
            width: 50,
            ellipsis: {
              tooltip: true,
            },
            key: "likeCount",
            render(row) {
              return formatNumber(row.likeCount || 0);
            },
          },

          {
            title: "创建于",
            key: "createdAt",
            sortOrder: "descend",
            sorter: "default",
            width: 200,
            render(row) {
              return <RelativeTime time={row.createdAt} />;
            },
          },
          {
            title: "修改于",
            key: "modifiedAt",
            sorter: "default",
            sortOrder: false,
            width: 200,
            render(row) {
              return <RelativeTime time={row.modifiedAt ?? row.createdAt} />;
            },
          },
          {
            title: "状态",
            key: "isPublished",
            width: 120,
            render(row) {
              return <StatusToggle isPublished={row.isPublished ?? false} />;
            },
          },
          {
            title: "操作",
            key: "_id",
            width: 100,
            fixed: "right",
            render(row) {
              return (
                <NSpace>
                  <NPopconfirm
                    positiveText="取消"
                    negativeText="删除"
                    onNegativeClick={() => handleDelete(row._id)}
                  >
                    {{
                      trigger: () => (
                        <NButton quaternary type="error" size="tiny">
                          移除
                        </NButton>
                      ),

                      default: () => (
                        <span class="max-w-48">
                          确定要删除
                          {row.title}
                          {" "}
                          ?
                        </span>
                      ),
                    }}
                  </NPopconfirm>
                </NSpace>
              );
            },
          },
        ]);

        return () => (
          <Table
            nTableProps={{
              async onUpdateFilters(filter: { title: string[] }, _column) {
                const { title } = filter;
                if (!title || title.length === 0) {
                  dbQuery.value = undefined;
                  refresh();
                  return;
                }
                dbQuery.value = title.reduce(
                  (acc, i) => ({ ...acc, [i]: true }),
                  {},
                );
                setPage(1);
              },
            }}
            loading={loading.value}
            columns={columns}
            data={data}
            onFetchData={refresh}
            pager={pager as any}
            onUpdateCheckedRowKeys={(keys) => {
              checkedRowKeys.value = keys;
            }}
            onUpdateSorter={async (props) => {
              setSort(props.sortBy, props.sortOrder as 0 | 1 | -1);
            }}
            checkedRowKey="_id"
          />
        );
      },
    });

    const { setActions } = useLayout();

    watchEffect(() => {
      setActions(
        <>
          <DeleteConfirmButton
            checkedRowKeys={checkedRowKeys.value}
            onDelete={async () => {
              const status = await Promise.allSettled(
                checkedRowKeys.value.map(_id => notesApi.delete(_id as string)),
              );

              for (const s of status) {
                if (s.status === "rejected") {
                  toast.error(`删除失败，${s.reason.message}`);
                }
              }

              checkedRowKeys.value.length = 0;
              queryClient.invalidateQueries({ queryKey: queryKeys.notes.all });
            }}
          />

          <HeaderActionButton to="/notes/edit" icon={<PlusIcon />} />
        </>,
      );
    });

    return () => (
      <div class="flex flex-col gap-4">
        <div class="flex gap-2 items-center">
          <NInput
            v-model:value={searchKeyword.value}
            placeholder="搜索标题..."
            clearable
            class="max-w-xs"
          >
            {{
              prefix: () => <SearchIcon class="text-neutral-400 h-4 w-4" />,
            }}
          </NInput>
        </div>

        {isMobile.value ? <CardList /> : <DataTable />}
      </div>
    );
  },
});
