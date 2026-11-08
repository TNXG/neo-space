import type { Metadata } from "next";
import { CommentManager } from "@/components/dashboard/comments/CommentManager";

export const metadata: Metadata = { title: "评论" };

/** Owner-authenticated browser data flows directly to the Rust comments API. */
export default function DashboardCommentsPage() {
  return <CommentManager />;
}
