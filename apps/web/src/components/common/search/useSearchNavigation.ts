import type { SearchItem } from "./types";
import type { SearchNoteResult, SearchPostResult } from "@/types/api";

import { useCallback } from "react";
import { useRouter } from "@/locales/navigation";

interface UseSearchNavigationProps {
  onOpenChange: (open: boolean) => void;
}

/**
 * 处理搜索结果的导航逻辑
 */
export function useSearchNavigation({ onOpenChange }: UseSearchNavigationProps) {
  const router = useRouter();

  const navigateToResult = useCallback((item: SearchItem) => {
    onOpenChange(false);
    if (item.type === "post") {
      const post = item.data as SearchPostResult;
      const category = post.category?.slug ?? "uncategorized";
      router.push(`/posts/${category}/${post.slug}`, {
        transitionTypes: ["nav-forward"],
      });
    } else {
      const note = item.data as SearchNoteResult;
      router.push(`/notes/${note.nid}`, {
        transitionTypes: ["nav-forward"],
      });
    }
  }, [onOpenChange, router]);

  return { navigateToResult };
}
