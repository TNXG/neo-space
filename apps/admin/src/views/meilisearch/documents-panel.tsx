import type { DataTableColumns } from "naive-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { Download, FileUp, Pencil, Plus, Trash2 } from "lucide-vue-next";
import {
  NButton,
  NDataTable,
  NDrawer,
  NDrawerContent,
  NInput,
  NPagination,
  NPopconfirm,
  NSpace,
  NTag,
} from "naive-ui";
import { computed, defineComponent, h, ref } from "vue";
import { toast } from "vue-sonner";

import { meilisearchApi } from "~/api/meilisearch";

type SearchDocument = Record<string, unknown>;

/** 将任意字段值压缩为表格可读文本。 */
const previewValue = (value: unknown): string => {
  if (typeof value === "string")
    return value.length > 100 ? `${value.slice(0, 100)}…` : value;
  return JSON.stringify(value);
};

/** 索引文档浏览、编辑、导入与导出面板。 */
export const MeilisearchDocumentsPanel = defineComponent({
  name: "MeilisearchDocumentsPanel",
  props: {
    indexUid: { type: String, required: true },
    primaryKey: { type: String, required: false, default: "id" },
  },
  setup(props) {
    const queryClient = useQueryClient();
    const page = ref(1);
    const pageSize = ref(50);
    const filter = ref("");
    const editorOpen = ref(false);
    const editorValue = ref("{}");

    const documentsQuery = useQuery({
      queryKey: ["meilisearch", "documents", () => props.indexUid, page, pageSize, filter],
      queryFn: () => meilisearchApi.getDocuments(
        props.indexUid,
        (page.value - 1) * pageSize.value,
        pageSize.value,
        filter.value,
      ),
    });

    /** 刷新当前索引的文档和索引统计。 */
    const refreshDocuments = (): void => {
      queryClient.invalidateQueries({ queryKey: ["meilisearch", "documents"] });
      queryClient.invalidateQueries({ queryKey: ["meilisearch", "overview"] });
    };

    const upsertMutation = useMutation({
      mutationFn: (documents: SearchDocument[]) => meilisearchApi.upsertDocuments(props.indexUid, documents),
      onSuccess: () => {
        toast.success("文档变更已进入 Meilisearch 任务队列");
        editorOpen.value = false;
        refreshDocuments();
      },
    });

    const deleteMutation = useMutation({
      mutationFn: (documentId: string) => meilisearchApi.deleteDocument(props.indexUid, documentId),
      onSuccess: () => {
        toast.success("删除任务已提交");
        refreshDocuments();
      },
    });

    /** 打开空白 JSON 编辑器以创建文档。 */
    const openCreateEditor = (): void => {
      editorValue.value = "{}";
      editorOpen.value = true;
    };

    /** 打开已有文档的 JSON 编辑器。 */
    const openEditEditor = (document: SearchDocument): void => {
      editorValue.value = JSON.stringify(document, null, 2);
      editorOpen.value = true;
    };

    /** 校验编辑器内容并提交文档。 */
    const saveEditor = (): void => {
      try {
        const parsed: unknown = JSON.parse(editorValue.value);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
          throw new TypeError("文档必须是 JSON 对象");
        upsertMutation.mutate([parsed as SearchDocument]);
      }
      catch (error) {
        toast.error(error instanceof Error ? error.message : "文档 JSON 格式错误");
      }
    };

    /** 读取 JSON 文件并批量导入对象数组。 */
    const importDocuments = async (event: Event): Promise<void> => {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file)
        return;
      try {
        const parsed: unknown = JSON.parse(await file.text());
        const documents = Array.isArray(parsed) ? parsed : [parsed];
        if (!documents.every(item => item && typeof item === "object" && !Array.isArray(item)))
          throw new TypeError("导入文件必须包含 JSON 对象或对象数组");
        upsertMutation.mutate(documents as SearchDocument[]);
      }
      catch (error) {
        toast.error(error instanceof Error ? error.message : "导入文件解析失败");
      }
      finally {
        input.value = "";
      }
    };

    /** 导出当前索引中的文档为 JSON 文件。 */
    const exportDocuments = async (): Promise<void> => {
      try {
        const data = await meilisearchApi.exportDocuments(props.indexUid);
        const blob = new Blob([JSON.stringify(data.results, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${props.indexUid}-${new Date().toISOString()}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      catch {
        toast.error("文档导出失败");
      }
    };

    const columns = computed<DataTableColumns<SearchDocument>>(() => {
      const firstDocument = documentsQuery.data.value?.results[0];
      const fields = firstDocument ? Object.keys(firstDocument).slice(0, 6) : [props.primaryKey];
      return [
        ...fields.map(field => ({
          title: field,
          key: field,
          ellipsis: { tooltip: true },
          render: (row: SearchDocument) => previewValue(row[field]),
        })),
        {
          title: "操作",
          key: "actions",
          width: 112,
          render: (row: SearchDocument) => h(NSpace, { size: 4 }, {
            default: () => [
              h(NButton, { quaternary: true, size: "small", class: "cursor-pointer", onClick: () => openEditEditor(row) }, { icon: () => h(Pencil) }),
              h(NPopconfirm, { onPositiveClick: () => deleteMutation.mutate(String(row[props.primaryKey])) }, {
                trigger: () => h(NButton, { quaternary: true, size: "small", type: "error", class: "cursor-pointer" }, { icon: () => h(Trash2) }),
                default: () => "确认删除该文档？",
              }),
            ],
          }),
        },
      ];
    });

    return () => (
      <div class="space-y-4">
        <div class="flex flex-wrap gap-3 items-center justify-between">
          <div class="flex gap-2 items-center flex-1 min-w-64">
            <NInput
              value={filter.value}
              onUpdateValue={(value) => { filter.value = value; page.value = 1; }}
              clearable
              placeholder="Meilisearch filter 表达式"
            />
            <NTag size="small">{documentsQuery.data.value?.total ?? 0} 条</NTag>
          </div>
          <NSpace>
            <label class="cursor-pointer inline-flex">
              <input class="hidden" type="file" accept="application/json,.json" onChange={importDocuments} />
              <NButton class="pointer-events-none" secondary loading={upsertMutation.isPending.value}>
                {{ icon: () => <FileUp />, default: () => "导入" }}
              </NButton>
            </label>
            <NButton class="cursor-pointer" secondary onClick={exportDocuments}>
              {{ icon: () => <Download />, default: () => "导出" }}
            </NButton>
            <NButton class="cursor-pointer" type="primary" onClick={openCreateEditor}>
              {{ icon: () => <Plus />, default: () => "新建文档" }}
            </NButton>
          </NSpace>
        </div>

        <NDataTable
          loading={documentsQuery.isPending.value}
          columns={columns.value}
          data={documentsQuery.data.value?.results ?? []}
          rowKey={row => String(row[props.primaryKey])}
          scrollX={900}
        />
        <div class="flex justify-end">
          <NPagination
            page={page.value}
            pageSize={pageSize.value}
            itemCount={documentsQuery.data.value?.total ?? 0}
            showSizePicker
            pageSizes={[20, 50, 100, 200]}
            onUpdatePage={value => page.value = value}
            onUpdatePageSize={(value) => { pageSize.value = value; page.value = 1; }}
          />
        </div>

        <NDrawer show={editorOpen.value} onUpdateShow={value => editorOpen.value = value} width="min(720px, 92vw)" placement="right">
          <NDrawerContent title="文档 JSON" closable>
            {{
              default: () => (
                <NInput value={editorValue.value} onUpdateValue={value => editorValue.value = value} type="textarea" autosize={{ minRows: 20 }} />
              ),
              footer: () => (
                <NButton class="cursor-pointer" type="primary" loading={upsertMutation.isPending.value} onClick={saveEditor}>
                  保存文档
                </NButton>
              ),
            }}
          </NDrawerContent>
        </NDrawer>
      </div>
    );
  },
});
