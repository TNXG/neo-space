import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CommentSectionServer, CommentSkeleton } from "@/components/comment";
import { MarkdownRenderer } from "@/components/common/markdown/MarkdownRenderer";
import { ArticleHeader, ArticleLayout, CopyrightCard, OutdatedAlert } from "@/components/layouts/article";
import { generateArticleJsonLd, JsonLd } from "@/components/seo/JsonLd";
import { getAdjacentPosts, getPostBySlug, getPosts, getUserProfile } from "@/lib/api-client";
import { extractTOC } from "@/lib/toc";

// ISR 配置：16小时过期
export const revalidate = 57600;

// 预生成最新的 20 篇文章
export async function generateStaticParams() {
  try {
    const { data } = await getPosts(1, 20);
    return data.items.map(post => ({
      category: post.category?.slug || "default",
      slug: post.slug,
    }));
  } catch {
    return [];
  }
}

interface PageProps {
  params: Promise<{
    slug: string;
    category: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug, category } = await params;

  try {
    const { data: post } = await getPostBySlug(slug);

    if (post.category?.slug !== category) {
      return { title: "文章不存在" };
    }

    const description = post.summary || post.text.slice(0, 150).replace(/\n/g, " ");
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe";

    return {
      title: post.title,
      description,
      keywords: post.tags,
      authors: [{ name: post.category?.name || "作者" }],
      openGraph: {
        title: post.title,
        description,
        type: "article",
        publishedTime: post.created,
        modifiedTime: post.modified || post.created,
        url: `${baseUrl}/posts/${post.category?.slug}/${post.slug}`,
        tags: post.tags,
      },
      twitter: {
        card: "summary_large_image",
        title: post.title,
        description,
      },
    };
  } catch {
    return { title: "文章不存在" };
  }
}

export default async function PostPage({ params }: PageProps) {
  const { slug, category } = await params;

  // 验证 category 不是 ObjectId 格式
  const isObjectId = /^[0-9a-f]{24}$/i.test(category);
  if (isObjectId) {
    notFound();
  }

  let post;
  let toc;
  let authorName = "作者";
  let adjacentPosts;

  try {
    const [{ data }, { data: user }, adjacentResponse] = await Promise.all([
      getPostBySlug(slug),
      getUserProfile(),
      getAdjacentPosts(slug),
    ]);
    post = data;
    authorName = user.name;
    adjacentPosts = adjacentResponse.data;

    if (post.category?.slug !== category) {
      notFound();
    }

    toc = await extractTOC(post.text);
  } catch {
    notFound();
  }

  // 获取文章发布年份
  const postYear = new Date(post.created).getFullYear().toString();

  // 生成 JSON-LD 结构化数据
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.tnxg.moe";
  const jsonLd = generateArticleJsonLd({
    title: post.title,
    description: post.summary || post.text.slice(0, 150).replace(/\n/g, " "),
    url: `${baseUrl}/posts/${post.category?.slug}/${post.slug}`,
    datePublished: post.created,
    dateModified: post.modified || post.created,
    authorName,
    keywords: post.tags,
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      <ArticleLayout
        toc={toc}
        breadcrumbs={[
          { label: "首页", href: "/" },
          ...(post.category ? [{ label: post.category.name, href: `/categories/${post.category.slug}` }] : []),
          { label: post.title },
        ]}
        header={(
          <ArticleHeader
            title={post.title}
            category={post.category}
            tags={post.tags}
            created={post.created}
            modified={post.modified}
            summary={post.summary}
            aiSummary={post.aiSummary}
            typeLabel="Article"
          />
        )}
        content={(
          <>
            <OutdatedAlert
              refId={post._id}
              refType="post"
              lastUpdated={post.modified || post.created}
            />
            <MarkdownRenderer content={post.text} />
          </>
        )}
        footer={(
          <>
            {post.copyright && (
              <CopyrightCard
                author={authorName}
                year={postYear}
                postTitle={post.title}
              />
            )}
            {post.allowComment && (
              <Suspense fallback={<CommentSkeleton />}>
                <CommentSectionServer
                  refId={post._id}
                  refType="posts"
                />
              </Suspense>
            )}
          </>
        )}
        navigation={{
          type: "post",
          prevLink: adjacentPosts.prev ? `/posts/${adjacentPosts.prev.categorySlug}/${adjacentPosts.prev.slug}` : undefined,
          nextLink: adjacentPosts.next ? `/posts/${adjacentPosts.next.categorySlug}/${adjacentPosts.next.slug}` : undefined,
          prevTitle: adjacentPosts.prev?.title,
          nextTitle: adjacentPosts.next?.title,
        }}
      />
    </>
  );
}
