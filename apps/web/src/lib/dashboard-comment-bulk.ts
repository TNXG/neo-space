import type { DashboardCommentState } from "@/types/dashboard-comments";
import { dashboardRequest } from "./dashboard-api";

/** Apply a state to the whole explicitly selected filter, including pages not currently visible. */
export function setAllDashboardCommentStates(currentState: DashboardCommentState, state: DashboardCommentState): Promise<number> {
  return dashboardRequest<number>("/comments/state", { method: "PATCH", body: JSON.stringify({ all: true, currentState, state }) });
}

/** Delete only the explicitly selected moderation bucket; descendants in other buckets remain untouched. */
export function deleteAllDashboardComments(state: DashboardCommentState): Promise<number> {
  return dashboardRequest<number>("/comments/batch", { method: "DELETE", body: JSON.stringify({ all: true, state }) });
}
