import type { NoteModel } from "~/models/note";
import type { PageModel } from "~/models/page";
import type { PostModel } from "~/models/post";
import type { RecentlyModel } from "~/models/recently";
import type { ZipFile } from "~/utils/zip";
import { dump } from "js-yaml";

import { notesApi, pagesApi, postsApi, recentlyApi } from "~/api";
import { createZipBlob } from "~/utils/zip";

const PAGE_SIZE = 100;

export interface ExportCounts {
  pages: number;
  posts: number;
  notes: number;
  recently: number;
}

export interface MarkdownExportResult {
  blob: Blob;
  counts: ExportCounts;
  fileName: string;
}

interface PaginatedData<T> {
  data: T[];
  pagination: {
    hasNextPage: boolean;
    currentPage: number;
    totalPage: number;
  };
}

/** 清理文件名中的路径字符，同时保留可读的中英文标题。 */
const sanitizeFileName = (value: string, fallback: string): string => {
  const sanitized = value
    .trim()
    .replaceAll(/[\\/:*?"<>|]/g, "-")
    .replaceAll(/\s+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^[-.]+|[-.]+$/g, "");

  return sanitized || fallback;
};

/** 将元数据和正文组合为标准 Markdown 文件。 */
const createMarkdown = (
  metadata: Record<string, unknown>,
  content: string,
): string => {
  const frontMatter = dump(metadata, {
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  }).trim();

  return `---\n${frontMatter}\n---\n\n${content.trim()}\n`;
};

/** 拉取一个分页接口的全部数据，并对异常分页信息设置安全终止条件。 */
const fetchAllPages = async <T>(
  fetchPage: (page: number) => Promise<PaginatedData<T>>,
): Promise<T[]> => {
  const items: T[] = [];
  let page = 1;

  while (true) {
    const result = await fetchPage(page);
    items.push(...result.data);

    const hasNextPage = result.pagination.hasNextPage
      || result.pagination.currentPage < result.pagination.totalPage;
    if (!hasNextPage || result.data.length === 0) {
      return items;
    }

    page += 1;
  }
};

/** 把页面转换为归档中的 Markdown 文件。 */
const mapPageToFile = (page: PageModel): ZipFile => ({
  path: `pages/${sanitizeFileName(page.slug || page.title, page._id)}.md`,
  content: createMarkdown(
    {
      title: page.title,
      subtitle: page.subtitle || undefined,
      slug: page.slug,
      created: page.createdAt || page.created,
      modified: page.modifiedAt || page.modified || undefined,
      type: page.type || "md",
    },
    page.text || "",
  ),
});

/** 把文章转换为归档中的 Markdown 文件。 */
const mapPostToFile = (post: PostModel): ZipFile => {
  const category = sanitizeFileName(
    post.category?.slug || "uncategorized",
    "uncategorized",
  );
  const slug = sanitizeFileName(post.slug || post.title, post._id);

  return {
    path: `posts/${category}/${slug}.md`,
    content: createMarkdown(
      {
        title: post.title,
        slug: post.slug,
        category: post.category?.name || undefined,
        categorySlug: post.category?.slug || undefined,
        tags: post.tags.length ? post.tags : undefined,
        summary: post.summary || undefined,
        created: post.createdAt,
        modified: post.modifiedAt || undefined,
        published: post.isPublished ?? true,
      },
      post.text || "",
    ),
  };
};

/** 把手记转换为归档中的 Markdown 文件。 */
const mapNoteToFile = (note: NoteModel): ZipFile => {
  const slug = sanitizeFileName(note.slug || note.title, note._id);

  return {
    path: `notes/${note.nid}-${slug}.md`,
    content: createMarkdown(
      {
        title: note.title,
        nid: note.nid,
        slug: note.slug || undefined,
        mood: note.mood || undefined,
        weather: note.weather || undefined,
        location: note.location || undefined,
        topic: note.topic?.name || undefined,
        created: note.createdAt,
        modified: note.modifiedAt || undefined,
        publicAt: note.publicAt || undefined,
        published: note.isPublished,
        bookmark: note.bookmark || undefined,
      },
      note.text || "",
    ),
  };
};

/** 把说说转换为归档中的 Markdown 文件。 */
const mapRecentlyToFile = (recently: RecentlyModel): ZipFile => {
  const date = recently.created.slice(0, 10) || "unknown-date";

  return {
    path: `recently/${date}-${recently._id}.md`,
    content: createMarkdown(
      {
        created: recently.created,
        modified: recently.modified || undefined,
        reference: recently.ref?.url || undefined,
        referenceTitle: recently.ref?.title || undefined,
        referenceType: recently.refType || undefined,
      },
      recently.content || "",
    ),
  };
};

/** 触发浏览器下载，并及时释放临时对象 URL。 */
export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** 拉取站点全部内容并生成 Markdown ZIP 归档。 */
export const createMarkdownExport = async (): Promise<MarkdownExportResult> => {
  const [pages, posts, notes, recently] = await Promise.all([
    fetchAllPages(page => pagesApi.getList({ page, size: PAGE_SIZE })),
    fetchAllPages(page => postsApi.getList({ page, size: PAGE_SIZE })),
    fetchAllPages(page => notesApi.getList({ page, size: PAGE_SIZE })),
    recentlyApi.getAll(),
  ]);
  const files = [
    ...pages.map(mapPageToFile),
    ...posts.map(mapPostToFile),
    ...notes.map(mapNoteToFile),
    ...recently.map(mapRecentlyToFile),
  ];
  const date = new Date().toISOString().slice(0, 10);

  return {
    blob: createZipBlob(files),
    fileName: `neo-space-markdown-${date}.zip`,
    counts: {
      pages: pages.length,
      posts: posts.length,
      notes: notes.length,
      recently: recently.length,
    },
  };
};
