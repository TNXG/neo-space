"use server";

import { ThinkingItem } from "@/components/layouts/thinking";
import { getRecently } from "@/lib/api-client";

export async function loadMoreThinkings(page: number, limit: number = 50) {
  const result = await getRecently(limit, page);
  const items = result.data.items;

  return {
    nodes: items.map(item => <ThinkingItem key={item._id} item={item} />),
    hasNextPage: result.data.pagination.has_next_page,
  };
}
