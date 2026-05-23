import type { PropType } from "vue";
import type { Pager } from "~/models/base";
import type { NoteModel } from "~/models/note";
import type { TopicModel } from "~/models/topic";
import { useMutation } from "@tanstack/vue-query";
import { ExternalLink, Hash, Pencil, Plus, X } from "lucide-vue-next";
import {
  NButton,
  NDrawer,
  NDrawerContent,
  NEmpty,
  NPopconfirm,
  NSelect,
  NUploadDragger,
} from "naive-ui";
import { defineComponent, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { toast } from "vue-sonner";

import { notesApi } from "~/api/notes";
import { topicsApi } from "~/api/topics";
import { RelativeTime } from "~/components/time/relative-time";
import { UploadWrapper } from "~/components/upload";
import { buildMarkdownRenderUrl } from "~/utils/endpoint";
import { textToBigCharOrWord } from "~/utils/word";

import { useMemoNoteList } from "../hooks/use-memo-note-list";

export const TopicDetailDrawer = defineComponent({
  name: "TopicDetailDrawer",
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    topicId: {
      type: String,
      required: true,
    },
    onClose: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onEdit: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
  },
  setup(props) {
    const router = useRouter();

    const topic = ref<TopicModel | null>(null);
    const notes = ref<Pick<NoteModel, "_id" | "title" | "nid" | "createdAt">[]>(
      [],
    );
    const notePagination = ref<Pager>();
    const loadingTopic = ref(false);
    const loadingNotes = ref(false);

    const fetchTopicDetail = async (id: string) => {
      loadingTopic.value = true;
      try {
        const data = await topicsApi.getById(id);
        topic.value = data;
        await fetchTopicNotes(id);
      } finally {
        loadingTopic.value = false;
      }
    };

    const fetchTopicNotes = async (topicId: string, page = 1, size = 10) => {
      loadingNotes.value = true;
      try {
        const { data, pagination } = await notesApi.getByTopic(topicId, {
          page,
          size,
        });
        notes.value = data as any;
        notePagination.value = pagination;
      } finally {
        loadingNotes.value = false;
      }
    };

    const removeNoteMutation = useMutation({
      mutationFn: (noteId: string) => notesApi.patch(noteId, { topicId: null }),
      onSuccess: (_, noteId) => {
        toast.success("已移除文章的专栏引用");
        const index = notes.value.findIndex(note => note._id === noteId);
        if (index !== -1) {
          notes.value.splice(index, 1);
        }
      },
    });

    const handleRemoveNoteFromTopic = (noteId: string) => {
      removeNoteMutation.mutate(noteId);
    };

    const updateIconMutation = useMutation({
      mutationFn: ({ id, icon }: { id: string; icon: string }) =>
        topicsApi.patch(id, { icon }),
      onSuccess: (_, { icon }) => {
        if (topic.value) {
          topic.value.icon = icon;
        }
      },
    });

    const handleUpdateTopicIcon = (iconUrl: string) => {
      if (!topic.value)
        return;
      updateIconMutation.mutate({ id: topic.value.id!, icon: iconUrl });
    };

    watch(
      () => [props.show, props.topicId],
      ([show, id]) => {
        if (show && id) {
          fetchTopicDetail(id as string);
        }
      },
      { immediate: true },
    );

    const showAddNoteModal = ref(false);

    return () => (
      <NDrawer
        show={props.show}
        width={480}
        class="max-w-[90vw]"
        placement="right"
        onUpdateShow={(show) => {
          if (!show)
            props.onClose();
        }}
      >
        <NDrawerContent
          title={topic.value ? `专栏 - ${topic.value.name}` : "专栏详情"}
          closable
          nativeScrollbar={false}
          bodyContentClass="!p-0"
        >
          {{
            header: () =>
              topic.value && (
                <div class="flex gap-2 items-center">
                  <span class="text-base font-medium">
                    专栏 -
                    {" "}
                    {topic.value.name}
                  </span>
                  <NButton
                    size="tiny"
                    quaternary
                    type="primary"
                    onClick={() => props.onEdit(topic.value!.id!)}
                    aria-label="编辑专栏"
                  >
                    <Pencil class="size-3.5" />
                  </NButton>
                </div>
              ),
            default: () =>
              loadingTopic.value ? (
                <TopicDetailSkeleton />
              ) : topic.value ? (
                <div class="px-5 py-4">
                  <div class="mb-6 p-4 border border-neutral-200 rounded-xl bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900/50">
                    <div class="flex gap-4 items-start">
                      <UploadWrapper
                        class="shrink-0"
                        type="icon"
                        onFinish={(e) => {
                          const res = JSON.parse(
                            (e.event?.target as XMLHttpRequest).responseText,
                          );
                          handleUpdateTopicIcon(res.url);
                          return e.file;
                        }}
                        onError={(e) => {
                          try {
                            const res = JSON.parse(
                              (e.event?.target as XMLHttpRequest).responseText,
                            );
                            toast.warning(res.message);
                          } catch {
                            // noop
                          }
                          return e.file;
                        }}
                      >
                        <NUploadDragger class="!p-0 !border-0 !bg-transparent">
                          <div class="group cursor-pointer relative">
                            {topic.value.icon
                              ? (
                                  <img
                                    src={topic.value.icon}
                                    alt={`${topic.value.name} 图标`}
                                    class="rounded-xl size-16 transition-opacity object-cover group-hover:opacity-70"
                                  />
                                )
                              : (
                                  <div class="text-xl text-neutral-600 font-semibold rounded-xl flex size-16 transition-opacity items-center justify-center from-neutral-200 to-neutral-300 bg-gradient-to-br dark:text-neutral-300 group-hover:opacity-70 dark:from-neutral-700 dark:to-neutral-600">
                                    {textToBigCharOrWord(topic.value.name)}
                                  </div>
                                )}
                            <div class="rounded-xl bg-black/40 opacity-0 flex transition-opacity items-center inset-0 justify-center absolute group-hover:opacity-100">
                              <Pencil class="text-white size-5" />
                            </div>
                          </div>
                        </NUploadDragger>
                      </UploadWrapper>

                      <div class="flex-1 min-w-0">
                        <h3 class="text-lg text-neutral-900 font-semibold dark:text-neutral-100">
                          {topic.value.name}
                        </h3>
                        <div class="text-xs text-neutral-400 mt-1 flex gap-1 items-center">
                          <Hash class="size-3" aria-hidden="true" />
                          <span class="font-mono">{topic.value.slug}</span>
                        </div>
                        {topic.value.introduce && (
                          <p class="text-sm text-neutral-600 mt-2 dark:text-neutral-400">
                            {topic.value.introduce}
                          </p>
                        )}
                      </div>
                    </div>

                    {topic.value.description && (
                      <p class="text-sm text-neutral-500 mt-4 dark:text-neutral-400">
                        {topic.value.description}
                      </p>
                    )}
                  </div>

                  <div>
                    <div class="mb-3 flex items-center justify-between">
                      <h4 class="text-sm text-neutral-700 font-medium dark:text-neutral-300">
                        包含的文章
                        {notePagination.value && (
                          <span class="text-xs text-neutral-400 ml-1">
                            (
                            {notePagination.value.total}
                            )
                          </span>
                        )}
                      </h4>
                      <NButton
                        size="small"
                        type="primary"
                        secondary
                        onClick={() => (showAddNoteModal.value = true)}
                        aria-label="添加文章到专栏"
                      >
                        {{
                          icon: () => <Plus class="size-4" />,
                          default: () => "添加",
                        }}
                      </NButton>
                    </div>

                    {loadingNotes.value && notes.value.length === 0
                      ? (
                          <NoteListSkeleton />
                        )
                      : notes.value.length === 0
                        ? (
                            <div class="py-8 border border-neutral-200 rounded-lg border-dashed flex flex-col items-center justify-center dark:border-neutral-800">
                              <NEmpty description="暂无文章">
                                {{
                                  extra: () => (
                                    <NButton
                                      size="small"
                                      onClick={() => (showAddNoteModal.value = true)}
                                    >
                                      添加文章
                                    </NButton>
                                  ),
                                }}
                              </NEmpty>
                            </div>
                          )
                        : (
                            <div class="space-y-2">
                              {notes.value.map(note => (
                                <NoteListItem
                                  key={note._id}
                                  note={note}
                                  onEdit={() => {
                                    router.push({
                                      path: "/notes/edit",
                                      query: { id: note._id },
                                    });
                                  }}
                                  onRemove={() => handleRemoveNoteFromTopic(note._id)}
                                  topicName={topic.value?.name}
                                />
                              ))}

                              {notePagination.value
                                && notePagination.value.totalPage > 1 && (
                                <div class="pt-4 flex gap-2 justify-center">
                                  <NButton
                                    size="small"
                                    disabled={!notePagination.value.hasPrevPage}
                                    onClick={() =>
                                      fetchTopicNotes(
                                        props.topicId,
                                        notePagination.value!.currentPage - 1,
                                      )}
                                  >
                                    上一页
                                  </NButton>
                                  <span class="text-sm text-neutral-500 flex items-center">
                                    {notePagination.value.currentPage}
                                    {" "}
                                    /
                                    {" "}
                                    {notePagination.value.totalPage}
                                  </span>
                                  <NButton
                                    size="small"
                                    disabled={!notePagination.value.hasNextPage}
                                    onClick={() =>
                                      fetchTopicNotes(
                                        props.topicId,
                                        notePagination.value!.currentPage + 1,
                                      )}
                                  >
                                    下一页
                                  </NButton>
                                </div>
                              )}
                            </div>
                          )}
                  </div>
                </div>
              ) : null,
          }}
        </NDrawerContent>

        {topic.value && (
          <AddNoteToTopicModal
            show={showAddNoteModal.value}
            topicId={topic.value.id!}
            onClose={() => (showAddNoteModal.value = false)}
            onSuccess={() => {
              showAddNoteModal.value = false;
              fetchTopicNotes(props.topicId);
            }}
          />
        )}
      </NDrawer>
    );
  },
});

const NoteListItem = defineComponent({
  props: {
    note: {
      type: Object as PropType<
        Pick<NoteModel, "_id" | "title" | "nid" | "createdAt">
      >,
      required: true,
    },
    onEdit: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onRemove: {
      type: Function as PropType<() => void>,
      required: true,
    },
    topicName: {
      type: String,
      required: false,
    },
  },
  setup(props) {
    return () => (
      <div class="group px-3 py-2.5 border border-neutral-200 rounded-lg flex transition-colors items-center justify-between dark:border-neutral-800 hover:border-neutral-300 hover:bg-neutral-50 dark:hover:border-neutral-700 dark:hover:bg-neutral-800/50">
        <div class="flex-1 min-w-0">
          <div class="flex gap-2 items-center">
            <span class="text-xs text-neutral-400 font-mono shrink-0">
              #
              {props.note.nid}
            </span>
            <span class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
              {props.note.title}
            </span>
          </div>
          <div class="text-xs text-neutral-400 mt-0.5">
            <RelativeTime time={props.note.createdAt} />
          </div>
        </div>

        <div class="opacity-0 flex shrink-0 gap-1 transition-opacity items-center group-hover:opacity-100">
          <a
            href={buildMarkdownRenderUrl(props.note._id)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`预览 ${props.note.title}`}
          >
            <NButton size="tiny" quaternary>
              <ExternalLink class="size-3.5" />
            </NButton>
          </a>
          <NButton
            size="tiny"
            quaternary
            type="primary"
            onClick={props.onEdit}
            aria-label={`编辑 ${props.note.title}`}
          >
            <Pencil class="size-3.5" />
          </NButton>
          <NPopconfirm onPositiveClick={props.onRemove}>
            {{
              trigger: () => (
                <NButton
                  size="tiny"
                  quaternary
                  type="error"
                  aria-label={`从专栏移除 ${props.note.title}`}
                >
                  <X class="size-3.5" />
                </NButton>
              ),
              default: () => (
                <span>
                  确定要从专栏「
                  {props.topicName}
                  」中移除此文章吗？
                </span>
              ),
            }}
          </NPopconfirm>
        </div>
      </div>
    );
  },
});

const AddNoteToTopicModal = defineComponent({
  props: {
    show: {
      type: Boolean,
      required: true,
    },
    topicId: {
      type: String,
      required: true,
    },
    onClose: {
      type: Function as PropType<() => void>,
      required: true,
    },
    onSuccess: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    const {
      refresh,
      fetchNext,
      datalist: noteList,
      loading: fetchingLoading,
    } = useMemoNoteList();

    const selectedNoteIds = ref<string[]>([]);
    const submitting = ref(false);

    const handleSubmit = async () => {
      if (selectedNoteIds.value.length === 0) {
        toast.warning("请选择要添加的文章");
        return;
      }

      submitting.value = true;
      try {
        await Promise.all(
          selectedNoteIds.value.map(noteId =>
            notesApi.patch(noteId, { topicId: props.topicId }),
          ),
        );
        toast.success("添加成功");
        selectedNoteIds.value = [];
        props.onSuccess();
      } finally {
        submitting.value = false;
      }
    };

    const handleScroll = (e: Event) => {
      const target = e.currentTarget as HTMLElement;
      if (target.scrollTop + target.offsetHeight + 10 >= target.scrollHeight) {
        fetchNext();
      }
    };

    onMounted(() => {
      if (noteList.value.length === 0) {
        fetchNext();
      }
    });

    return () => (
      <div
        v-show={props.show}
        class="bg-black/50 flex items-center inset-0 justify-center fixed z-50"
        onClick={(e) => {
          if (e.target === e.currentTarget)
            props.onClose();
        }}
      >
        <div
          class="p-5 rounded-xl bg-white max-w-md w-full shadow-xl dark:bg-neutral-900"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-note-dialog-title"
        >
          <div class="mb-4 flex items-center justify-between">
            <h3
              id="add-note-dialog-title"
              class="text-lg text-neutral-900 font-semibold dark:text-neutral-100"
            >
              添加文章到专栏
            </h3>
            <button
              type="button"
              class="text-neutral-400 p-1 rounded-lg transition-colors hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={props.onClose}
              aria-label="关闭"
            >
              <X class="size-5" />
            </button>
          </div>

          <div class="mb-4">
            <NSelect
              multiple
              filterable
              clearable
              loading={fetchingLoading.value}
              value={selectedNoteIds.value}
              onUpdateValue={values => (selectedNoteIds.value = values)}
              maxTagCount={3}
              options={noteList.value.map(note => ({
                label: note.title,
                value: note._id,
                key: note._id,
              }))}
              placeholder="选择要添加的文章"
              resetMenuOnOptionsChange={false}
              onClear={refresh}
              onScroll={handleScroll}
            />
          </div>

          <div class="flex gap-2 justify-end">
            <NButton onClick={props.onClose}>取消</NButton>
            <NButton
              type="primary"
              loading={submitting.value}
              disabled={selectedNoteIds.value.length === 0}
              onClick={handleSubmit}
            >
              添加 (
              {selectedNoteIds.value.length}
              )
            </NButton>
          </div>
        </div>
      </div>
    );
  },
});

const TopicDetailSkeleton = defineComponent({
  setup() {
    return () => (
      <div class="px-5 py-4 animate-pulse">
        <div class="mb-6 p-4 border border-neutral-200 rounded-xl bg-neutral-50/50 dark:border-neutral-800 dark:bg-neutral-900/50">
          <div class="flex gap-4 items-start">
            <div class="rounded-xl bg-neutral-200 size-16 dark:bg-neutral-700" />
            <div class="flex-1">
              <div class="rounded bg-neutral-200 h-6 w-32 dark:bg-neutral-700" />
              <div class="mt-2 rounded bg-neutral-100 h-4 w-20 dark:bg-neutral-800" />
              <div class="mt-3 rounded bg-neutral-100 h-4 w-full dark:bg-neutral-800" />
            </div>
          </div>
        </div>
        <div class="space-y-2">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              class="rounded-lg bg-neutral-100 h-16 dark:bg-neutral-800"
            />
          ))}
        </div>
      </div>
    );
  },
});

const NoteListSkeleton = defineComponent({
  setup() {
    return () => (
      <div class="animate-pulse space-y-2">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            class="rounded-lg bg-neutral-100 h-16 dark:bg-neutral-800"
          />
        ))}
      </div>
    );
  },
});
