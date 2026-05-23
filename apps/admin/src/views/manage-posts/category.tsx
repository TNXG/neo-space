import type { PropType, Ref } from "vue";
import type { CategoryModel, TagModel } from "~/models/category";
import type { PostModel } from "~/models/post";
import { useMutation, useQuery } from "@tanstack/vue-query";
import {
  Plus as AddIcon,
  ArrowLeft as ArrowLeftIcon,
  FolderOpen,
  Hash,
  Pencil,
  Tag as TagIcon,
  Trash2,
} from "lucide-vue-next";
import {
  NButton,
  NCard,
  NForm,
  NFormItemRow,
  NInput,
  NModal,
  NPopconfirm,
  NScrollbar,
  NSkeleton,
} from "naive-ui";
import {
  computed,
  defineComponent,
  onMounted,
  reactive,
  ref,
  watch,
  watchEffect,
} from "vue";
import { RouterLink } from "vue-router";

import { toast } from "vue-sonner";

import { categoriesApi } from "~/api/categories";
import { postsApi } from "~/api/posts";
import { HeaderActionButton } from "~/components/button/header-action-button";
import { MasterDetailLayout, useMasterDetailLayout } from "~/components/layout";
import { RelativeTime } from "~/components/time/relative-time";
import { queryKeys } from "~/hooks/queries/keys";
import {
  usePostsByTagQuery,
  useTagsQuery,
} from "~/hooks/queries/use-categories";
import { useStoreRef } from "~/hooks/use-store-ref";
import { useLayout } from "~/layouts/content";
import { CategoryStore } from "~/stores/category";

interface CategoryState {
  name: string;
  slug: string;
}

type SelectedItem
  = | {
    kind: "category";
    id: string;
  }
  | {
    kind: "tag";
    name: string;
  };

export const CategoryView = defineComponent({
  name: "CategoryView",
  setup() {
    const categoryStore = useStoreRef(CategoryStore);
    const { setActions } = useLayout();
    const { isMobile } = useMasterDetailLayout();

    const categoriesLoading = ref(true);
    const fetchCategories = async (force?: boolean) => {
      categoriesLoading.value = true;
      try {
        await categoryStore.fetch(force);
      } finally {
        categoriesLoading.value = false;
      }
    };

    const { data: tagsData, isLoading: tagsLoading } = useTagsQuery();
    const tags = computed(() => tagsData.value ?? []);
    const categories = computed(() => categoryStore.data.value ?? []);

    onMounted(async () => {
      await fetchCategories();
    });

    const selectedItem = ref<SelectedItem | null>(null);
    const showDetailOnMobile = ref(false);

    const selectedCategory = computed(() => {
      const current = selectedItem.value;
      if (!current || current.kind !== "category")
        return null;
      return categories.value.find(item => item.id === current.id);
    });

    const selectedTag = computed(() => {
      const current = selectedItem.value;
      if (!current || current.kind !== "tag")
        return null;
      return tags.value.find(item => item.name === current.name);
    });

    const selectedCategoryId = computed(() => selectedCategory.value?.id ?? "");
    const selectedTagName = computed(() => selectedTag.value?.name ?? "");

    const { data: categoryPostsData, isLoading: categoryPostsLoading }
      = useQuery({
        queryKey: computed(() =>
          queryKeys.posts.list({
            scope: "category-detail",
            categoryId: selectedCategoryId.value,
            page: 1,
            size: 20,
          }),
        ),
        queryFn: async () => {
          const res = await postsApi.getList({
            page: 1,
            size: 20,
            categoryIds: [selectedCategoryId.value],
            select: "id title created count category slug",
          });
          return res;
        },
        enabled: computed(() => !!selectedCategoryId.value),
      });

    const { data: tagPostsData, isLoading: tagPostsLoading }
      = usePostsByTagQuery(selectedTagName);

    const selectedCategoryPosts = computed(() => categoryPostsData.value?.data ?? []);
    const selectedCategoryPostCount = computed(
      () => categoryPostsData.value?.pagination.total ?? selectedCategoryPosts.value.length,
    );
    const selectedTagPosts = computed(() => tagPostsData.value ?? []);

    watch(
      categories,
      (list) => {
        const current = selectedItem.value;
        if (!current || current.kind !== "category")
          return;
        const exists = list.some(item => item.id === current.id);
        if (!exists) {
          selectedItem.value = null;
          showDetailOnMobile.value = false;
        }
      },
      { immediate: true },
    );

    watch(
      tags,
      (list) => {
        const current = selectedItem.value;
        if (!current || current.kind !== "tag")
          return;
        const exists = list.some(item => item.name === current.name);
        if (!exists) {
          selectedItem.value = null;
          showDetailOnMobile.value = false;
        }
      },
      { immediate: true },
    );

    const handleSelectCategory = (id: string) => {
      selectedItem.value = { kind: "category", id };
      if (isMobile.value) {
        showDetailOnMobile.value = true;
      }
    };

    const handleSelectTag = (name: string) => {
      selectedItem.value = { kind: "tag", name };
      if (isMobile.value) {
        showDetailOnMobile.value = true;
      }
    };

    const handleBack = () => {
      showDetailOnMobile.value = false;
    };

    const resetState = () => ({ name: "", slug: "" });
    const showDialog = ref<boolean | string>(false);
    const editCategoryState = ref<CategoryState>(resetState());

    const openCreateDialog = () => {
      editCategoryState.value = resetState();
      showDialog.value = true;
    };

    const deleteMutation = useMutation({
      mutationFn: categoriesApi.delete,
      onSuccess: async (_, id) => {
        toast.success("删除成功");
        if (
          selectedItem.value?.kind === "category"
          && selectedItem.value.id === id
        ) {
          selectedItem.value = null;
          showDetailOnMobile.value = false;
        }
        await fetchCategories(true);
      },
    });

    const createMutation = useMutation({
      mutationFn: categoriesApi.create,
      onSuccess: (category) => {
        toast.success("创建成功");

        if (!categoryStore.data.value) {
          categoryStore.data.value = [category];
        } else {
          categoryStore.data.value.push(category);
        }

        selectedItem.value = { kind: "category", id: category.id };
        if (isMobile.value) {
          showDetailOnMobile.value = true;
        }

        showDialog.value = false;
      },
    });

    const updateMutation = useMutation({
      mutationFn: ({
        id,
        data,
      }: {
        id: string;
        data: { name: string; slug: string; type: number };
      }) => categoriesApi.update(id, data),
      onSuccess: (_, { id, data }) => {
        toast.success("修改成功");
        const index = categoryStore.data.value?.findIndex(
          item => item.id === id,
        );

        if (
          typeof index === "number"
          && index > -1
          && categoryStore.data.value
        ) {
          categoryStore.data.value[index] = {
            ...categoryStore.data.value[index],
            name: data.name,
            slug: data.slug,
          };
        }

        showDialog.value = false;
      },
    });

    watchEffect(() => {
      setActions(
        <HeaderActionButton
          variant="success"
          icon={<AddIcon />}
          name="新建分类"
          onClick={openCreateDialog}
        />,
      );
    });

    return () => (
      <>
        <MasterDetailLayout
          showDetailOnMobile={showDetailOnMobile.value}
          defaultSize="300px"
          min="200px"
          max={0.42}
        >
          {{
            list: () => (
              <CategoryTagListPanel
                categories={categories.value}
                categoriesLoading={categoriesLoading.value}
                tags={tags.value}
                tagsLoading={tagsLoading.value}
                selectedItem={selectedItem.value}
                onSelectCategory={handleSelectCategory}
                onSelectTag={handleSelectTag}
                onAddCategory={openCreateDialog}
              />
            ),
            detail: () =>
              selectedCategory.value
                ? (
                    <CategoryDetailPanel
                      category={selectedCategory.value}
                      posts={selectedCategoryPosts.value}
                      postCount={selectedCategoryPostCount.value}
                      postsLoading={categoryPostsLoading.value}
                      isMobile={isMobile.value}
                      onBack={handleBack}
                      onEdit={(id) => {
                        const current = categories.value.find(
                          item => item.id === id,
                        );
                        if (!current)
                          return;
                        editCategoryState.value = {
                          name: current.name,
                          slug: current.slug,
                        };
                        showDialog.value = id;
                      }}
                      onDelete={id => deleteMutation.mutate(id)}
                    />
                  )
                : selectedTag.value
                  ? (
                      <TagDetailPanel
                        tag={selectedTag.value}
                        posts={selectedTagPosts.value}
                        postsLoading={tagPostsLoading.value}
                        isMobile={isMobile.value}
                        onBack={handleBack}
                      />
                    )
                  : null,
            empty: () => <CategoryDetailEmptyState />,
          }}
        </MasterDetailLayout>

        <EditCategoryDialog
          show={showDialog}
          initialState={editCategoryState.value}
          onSubmit={(state) => {
            const id
              = typeof showDialog.value === "string" ? showDialog.value : null;
            if (!id) {
              createMutation.mutate({ name: state.name, slug: state.slug });
              return;
            }

            updateMutation.mutate({
              id,
              data: {
                name: state.name,
                slug: state.slug,
                type: 0,
              },
            });
          }}
        />
      </>
    );
  },
});

const CategoryTagListPanel = defineComponent({
  name: "CategoryTagListPanel",
  props: {
    categories: {
      type: Array as PropType<CategoryModel[]>,
      required: true,
    },
    categoriesLoading: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: Array as PropType<TagModel[]>,
      required: true,
    },
    tagsLoading: {
      type: Boolean,
      default: false,
    },
    selectedItem: {
      type: Object as PropType<SelectedItem | null>,
      default: null,
    },
    onSelectCategory: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
    onSelectTag: {
      type: Function as PropType<(name: string) => void>,
      required: true,
    },
    onAddCategory: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex h-12 items-center justify-between dark:border-neutral-800">
          <span class="text-base text-neutral-900 font-semibold flex gap-1.5 items-center dark:text-neutral-100">
            <FolderOpen class="size-4" />
            分类与标签
          </span>

          <span class="text-xs text-neutral-400">
            {props.categories.length}
            {" "}
            /
            {props.tags.length}
          </span>
        </div>

        <NScrollbar class="flex-1 min-h-0">
          <div>
            <section>
              <div class="px-4 border-b border-neutral-100 bg-neutral-50/70 flex h-9 items-center justify-between dark:border-neutral-800/60 dark:bg-neutral-900/60">
                <h3 class="text-xs text-neutral-500 tracking-wide font-medium uppercase">
                  分类
                </h3>
                <span class="text-xs text-neutral-400">
                  {props.categories.length}
                </span>
              </div>

              {props.categoriesLoading
                ? (
                    <ListSectionSkeleton count={4} />
                  )
                : props.categories.length === 0
                  ? (
                      <div class="px-4 py-8 text-center border-b border-neutral-100 dark:border-neutral-800/60">
                        <p class="text-sm text-neutral-500 dark:text-neutral-400">
                          暂无分类
                        </p>
                        <NButton
                          size="small"
                          type="primary"
                          class="mt-3"
                          onClick={props.onAddCategory}
                        >
                          创建分类
                        </NButton>
                      </div>
                    )
                  : (
                      props.categories.map(item => (
                        <CategoryListRow
                          key={item.id}
                          category={item}
                          selected={
                            props.selectedItem?.kind === "category"
                            && props.selectedItem.id === item.id
                          }
                          onSelect={() => props.onSelectCategory(item.id)}
                        />
                      ))
                    )}
            </section>

            <section>
              <div class="px-4 border-b border-neutral-100 bg-neutral-50/70 flex h-9 items-center justify-between dark:border-neutral-800/60 dark:bg-neutral-900/60">
                <h3 class="text-xs text-neutral-500 tracking-wide font-medium uppercase">
                  标签
                </h3>
                <span class="text-xs text-neutral-400">
                  {props.tags.length}
                </span>
              </div>

              {props.tagsLoading
                ? (
                    <ListSectionSkeleton count={6} compact />
                  )
                : props.tags.length === 0
                  ? (
                      <div class="px-4 py-8 text-center border-b border-neutral-100 dark:border-neutral-800/60">
                        <p class="text-sm text-neutral-500 dark:text-neutral-400">
                          暂无标签
                        </p>
                      </div>
                    )
                  : (
                      props.tags.map(tag => (
                        <TagListRow
                          key={tag.name}
                          tag={tag}
                          selected={
                            props.selectedItem?.kind === "tag"
                            && props.selectedItem.name === tag.name
                          }
                          onSelect={() => props.onSelectTag(tag.name)}
                        />
                      ))
                    )}
            </section>
          </div>
        </NScrollbar>
      </div>
    );
  },
});

const CategoryListRow = defineComponent({
  name: "CategoryListRow",
  props: {
    category: {
      type: Object as PropType<CategoryModel>,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    onSelect: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <button
        type="button"
        class={[
          "flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors dark:border-neutral-800/60",
          props.selected
            ? "bg-neutral-100 dark:bg-neutral-800"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40",
        ]}
        onClick={props.onSelect}
      >
        <FolderOpen class="text-neutral-400 shrink-0 size-4" />

        <div class="flex-1 min-w-0">
          <h4 class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
            {props.category.name}
          </h4>
          <div class="text-xs text-neutral-400 mt-0.5 flex gap-1 items-center">
            <Hash class="shrink-0 size-3" />
            <span class="font-mono truncate">{props.category.slug}</span>
          </div>
        </div>

        <span class="text-xs text-neutral-400">{props.category.count}</span>
      </button>
    );
  },
});

const TagListRow = defineComponent({
  name: "TagListRow",
  props: {
    tag: {
      type: Object as PropType<TagModel>,
      required: true,
    },
    selected: {
      type: Boolean,
      default: false,
    },
    onSelect: {
      type: Function as PropType<() => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <button
        type="button"
        class={[
          "flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition-colors dark:border-neutral-800/60",
          props.selected
            ? "bg-neutral-100 dark:bg-neutral-800"
            : "hover:bg-neutral-50 dark:hover:bg-neutral-800/40",
        ]}
        onClick={props.onSelect}
      >
        <TagIcon class="text-neutral-400 shrink-0 size-4" />

        <div class="flex-1 min-w-0">
          <h4 class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
            {props.tag.name}
          </h4>
          <p class="text-xs text-neutral-400 mt-0.5">标签</p>
        </div>

        <span class="text-xs text-neutral-400">{props.tag.count}</span>
      </button>
    );
  },
});

const CategoryDetailPanel = defineComponent({
  name: "CategoryDetailPanel",
  props: {
    category: {
      type: Object as PropType<CategoryModel>,
      required: true,
    },
    posts: {
      type: Array as PropType<PostModel[]>,
      required: true,
    },
    postCount: {
      type: Number,
      required: true,
    },
    postsLoading: {
      type: Boolean,
      default: false,
    },
    isMobile: {
      type: Boolean,
      default: false,
    },
    onBack: {
      type: Function as PropType<() => void>,
    },
    onEdit: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
    onDelete: {
      type: Function as PropType<(id: string) => void>,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex flex-shrink-0 h-12 items-center justify-between dark:border-neutral-800">
          <div class="flex gap-3 items-center">
            {props.isMobile && props.onBack && (
              <button
                onClick={props.onBack}
                class="text-neutral-500 rounded-md flex size-8 items-center justify-center dark:text-neutral-400 hover:text-neutral-900 -ml-2 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <ArrowLeftIcon class="size-5" />
              </button>
            )}
            <h2 class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
              分类详情
            </h2>
          </div>

          <div class="flex gap-1 items-center">
            <NButton
              size="small"
              quaternary
              onClick={() => props.onEdit(props.category.id)}
            >
              {{
                icon: () => <Pencil class="size-4" />,
                default: () => "编辑",
              }}
            </NButton>

            <NPopconfirm
              positiveText="确认删除"
              negativeText="取消"
              onPositiveClick={() => props.onDelete(props.category.id)}
            >
              {{
                trigger: () => (
                  <NButton size="small" quaternary type="error">
                    {{
                      icon: () => <Trash2 class="size-4" />,
                      default: () => "删除",
                    }}
                  </NButton>
                ),
                default: () => `确定要删除「${props.category.name}」吗？`,
              }}
            </NPopconfirm>
          </div>
        </div>

        <NScrollbar class="flex-1 min-h-0">
          <div class="mx-auto p-6 max-w-3xl space-y-6">
            <div class="p-4 border border-neutral-200 rounded-xl bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <div class="flex gap-4 items-start">
                <div class="rounded-xl bg-neutral-100 flex shrink-0 size-12 items-center justify-center dark:bg-neutral-800">
                  <FolderOpen class="text-neutral-500 size-6" />
                </div>

                <div class="flex-1 min-w-0">
                  <h3 class="text-lg text-neutral-900 font-semibold truncate dark:text-neutral-100">
                    {props.category.name}
                  </h3>
                  <div class="text-xs text-neutral-400 mt-1 flex gap-1 items-center">
                    <Hash class="shrink-0 size-3" />
                    <span class="font-mono truncate">
                      {props.category.slug}
                    </span>
                  </div>
                  <div class="text-xs text-neutral-500 mt-2 flex gap-3 items-center dark:text-neutral-400">
                    <span>
                      {props.postCount}
                      {" "}
                      篇文章
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <PostListSection
              title="该分类下的文章"
              loading={props.postsLoading}
              posts={props.posts}
              emptyText="该分类下暂无文章"
            />
          </div>
        </NScrollbar>
      </div>
    );
  },
});

const TagDetailPanel = defineComponent({
  name: "TagDetailPanel",
  props: {
    tag: {
      type: Object as PropType<TagModel>,
      required: true,
    },
    posts: {
      type: Array as PropType<PostModel[]>,
      required: true,
    },
    postsLoading: {
      type: Boolean,
      default: false,
    },
    isMobile: {
      type: Boolean,
      default: false,
    },
    onBack: {
      type: Function as PropType<() => void>,
    },
  },
  setup(props) {
    return () => (
      <div class="flex flex-col h-full">
        <div class="px-4 border-b border-neutral-200 flex flex-shrink-0 gap-3 h-12 items-center dark:border-neutral-800">
          {props.isMobile && props.onBack && (
            <button
              onClick={props.onBack}
              class="text-neutral-500 rounded-md flex size-8 items-center justify-center dark:text-neutral-400 hover:text-neutral-900 -ml-2 hover:bg-neutral-100 dark:hover:text-neutral-100 dark:hover:bg-neutral-800"
            >
              <ArrowLeftIcon class="size-5" />
            </button>
          )}
          <h2 class="text-sm text-neutral-900 font-medium dark:text-neutral-100">
            标签详情
          </h2>
        </div>

        <NScrollbar class="flex-1 min-h-0">
          <div class="mx-auto p-6 max-w-3xl space-y-6">
            <div class="p-4 border border-neutral-200 rounded-xl bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <div class="flex gap-4 items-start">
                <div class="rounded-xl bg-neutral-100 flex shrink-0 size-12 items-center justify-center dark:bg-neutral-800">
                  <TagIcon class="text-neutral-500 size-6" />
                </div>

                <div class="flex-1 min-w-0">
                  <h3 class="text-lg text-neutral-900 font-semibold truncate dark:text-neutral-100">
                    {props.tag.name}
                  </h3>
                  <p class="text-xs text-neutral-500 mt-2 dark:text-neutral-400">
                    共
                    {" "}
                    {props.tag.count}
                    {" "}
                    篇文章使用该标签
                  </p>
                </div>
              </div>
            </div>

            <PostListSection
              title={`「${props.tag.name}」关联的文章`}
              loading={props.postsLoading}
              posts={props.posts}
              emptyText="暂无关联文章"
            />
          </div>
        </NScrollbar>
      </div>
    );
  },
});

const PostListSection = defineComponent({
  name: "PostListSection",
  props: {
    title: {
      type: String,
      required: true,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    posts: {
      type: Array as PropType<PostModel[]>,
      required: true,
    },
    emptyText: {
      type: String,
      default: "暂无文章",
    },
  },
  setup(props) {
    return () => (
      <section>
        <div class="mb-3 flex items-center justify-between">
          <h4 class="text-sm text-neutral-700 font-medium dark:text-neutral-300">
            {props.title}
          </h4>
          {!props.loading && props.posts.length > 0 && (
            <span class="text-xs text-neutral-400">
              {props.posts.length}
              {" "}
              篇
            </span>
          )}
        </div>

        {props.loading
          ? (
              <div class="space-y-2">
                {[1, 2, 3, 4].map(item => (
                  <div
                    key={item}
                    class="rounded-lg bg-neutral-100 h-11 animate-pulse dark:bg-neutral-800"
                  />
                ))}
              </div>
            )
          : props.posts.length === 0
            ? (
                <p class="text-sm text-neutral-500 px-4 py-6 text-center border border-neutral-200 rounded-lg border-dashed bg-neutral-50/60 dark:text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900/50">
                  {props.emptyText}
                </p>
              )
            : (
                <div class="border border-neutral-200 rounded-lg bg-white overflow-hidden dark:border-neutral-800 dark:bg-neutral-900">
                  {props.posts.map(post => (
                    <RouterLink
                      key={post._id}
                      to={`/posts/edit?id=${post._id}`}
                      class="px-4 py-3 border-b border-neutral-100 flex gap-4 transition-colors items-center justify-between last:border-b-0 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <div class="flex-1 min-w-0">
                        <p class="text-sm text-neutral-900 font-medium truncate dark:text-neutral-100">
                          {post.title}
                        </p>
                        <div class="text-xs text-neutral-400 mt-1 flex gap-2 items-center">
                          <RelativeTime time={post.createdAt} />
                          {typeof post.readCount === "number" && (
                            <>
                              <span>·</span>
                              <span>
                                {post.readCount}
                                {" "}
                                阅读
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {post.category?.name && (
                        <span class="text-xs text-neutral-500 shrink-0">
                          {post.category.name}
                        </span>
                      )}
                    </RouterLink>
                  ))}
                </div>
              )}
      </section>
    );
  },
});

const CategoryDetailEmptyState = defineComponent({
  name: "CategoryDetailEmptyState",
  setup() {
    return () => (
      <div class="flex h-full items-center justify-center">
        <div class="text-center">
          <div class="mx-auto mb-4 rounded-full bg-neutral-100 flex size-14 items-center justify-center dark:bg-neutral-800">
            <FolderOpen class="text-neutral-400 size-7" />
          </div>
          <h3 class="text-base text-neutral-900 font-medium dark:text-neutral-100">
            选择一个分类或标签
          </h3>
          <p class="text-sm text-neutral-500 mt-1 dark:text-neutral-400">
            左侧点击项目后在这里查看详情
          </p>
        </div>
      </div>
    );
  },
});

const ListSectionSkeleton = defineComponent({
  name: "ListSectionSkeleton",
  props: {
    count: {
      type: Number,
      default: 4,
    },
    compact: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    return () => (
      <div>
        {Array.from({ length: props.count }).map((_, index) => (
          <div
            key={index}
            class={[
              "flex items-center gap-3 border-b border-neutral-100 px-4 dark:border-neutral-800/60",
              props.compact ? "py-2.5" : "py-3",
            ]}
          >
            <NSkeleton width={16} height={16} class="rounded" />
            <div class="flex-1">
              <NSkeleton width="40%" height={16} class="rounded" />
              <NSkeleton width="28%" height={12} class="mt-1 rounded" />
            </div>
            <NSkeleton width={24} height={12} class="rounded" />
          </div>
        ))}
      </div>
    );
  },
});

const EditCategoryDialog = defineComponent<{
  initialState?: CategoryState;
  onSubmit: (state: CategoryState) => void;
  show: Ref<boolean | string>;
}>((props) => {
  const state = reactive<CategoryState>(
    props.initialState ?? { name: "", slug: "" },
  );

  watch(
    () => props.initialState,
    (next) => {
      if (!next)
        return;
      state.name = next.name;
      state.slug = next.slug;
    },
    { immediate: true },
  );

  const handleSubmit = () => {
    if (!state.name || !state.slug) {
      toast.error("名称和路径不能为空");
      return;
    }

    props.onSubmit(state);
  };

  return () => (
    <NModal
      transformOrigin="center"
      show={!!props.show.value}
      onUpdateShow={(next) => {
        props.show.value = next;
      }}
    >
      {{
        default: () => (
          <NCard
            style="width: 480px; max-width: 90vw"
            headerStyle={{ textAlign: "center" }}
            title={
              typeof props.show.value === "string" ? "编辑分类" : "新建分类"
            }
            bordered={false}
            class="!rounded-xl"
          >
            <NForm onSubmit={handleSubmit} model={state}>
              <NFormItemRow
                path="name"
                label="名称"
                rule={{
                  required: true,
                  message: "请输入分类名称",
                  trigger: ["input", "blur"],
                }}
              >
                <NInput
                  placeholder="输入分类名称..."
                  onInput={(value) => {
                    state.name = value;
                  }}
                  value={state.name}
                  autofocus
                  inputProps={{ autocomplete: "off" }}
                />
              </NFormItemRow>

              <NFormItemRow
                path="slug"
                label="路径"
                rule={{
                  required: true,
                  message: "请输入分类路径",
                  trigger: ["input", "blur"],
                }}
              >
                <NInput
                  placeholder="输入分类路径..."
                  onInput={(value) => {
                    state.slug = value;
                  }}
                  value={state.slug}
                  inputProps={{ autocomplete: "off" }}
                />
              </NFormItemRow>

              <div class="mt-6 flex gap-3 justify-end">
                <NButton onClick={() => (props.show.value = false)} round>
                  取消
                </NButton>
                <NButton type="primary" onClick={handleSubmit} round>
                  确定
                </NButton>
              </div>
            </NForm>
          </NCard>
        ),
      }}
    </NModal>
  );
})
;(EditCategoryDialog as any).props = [
  "initialState",
  "onSubmit",
  "show",
] as const;
