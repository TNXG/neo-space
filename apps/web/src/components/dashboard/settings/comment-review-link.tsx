"use client";

import type { OptionDocument } from "@/types/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/lib/icons/inline-icon";
import { Link } from "@/locales/navigation";
import { resolveCommentReview } from "./comment-review-model";

interface CommentReviewLinkProps {
  comments?: OptionDocument;
  ai?: OptionDocument;
  aiDirty: boolean;
  from: "comments" | "ai";
}

/** 两页显示同一真实配置来源；未保存的 AI 草稿不会被误报为已生效。 */
export function CommentReviewLink({ comments, ai, aiDirty, from }: CommentReviewLinkProps) {
  const review = resolveCommentReview(ai);
  const enabled = comments?.antiSpam === true && comments?.aiReview === true;
  const href = from === "comments" ? "/dashboard/settings/ai#commentReviewModel" : "/dashboard/settings/comments#setting-commentOptions-aiReview";
  return (
    <Alert>
      <Icon icon="mingcute:shield-shape-line" aria-hidden="true" />
      <AlertTitle className="flex flex-wrap items-center gap-2">
        AI 审核状态
        <Badge variant={enabled && review.ready ? "secondary" : "outline"}>{!comments ? "加载中" : enabled ? review.ready ? "运行中" : "待完善" : "未开启"}</Badge>
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-1.5">
        <p>{review.ready ? `当前使用模型：${review.reason}。` : review.reason}</p>
        {aiDirty && <p className="font-medium text-foreground">AI 服务有未保存的更改，保存后才会对评论审核生效。</p>}
        <Link href={href} className="w-fit cursor-pointer rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">
          {from === "comments" ? "前往 AI 服务选择审核模型 →" : "前往评论设置开启 AI 审核 →"}
        </Link>
      </AlertDescription>
    </Alert>
  );
}
