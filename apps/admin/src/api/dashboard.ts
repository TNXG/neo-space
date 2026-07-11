import { request } from "~/utils/request";

interface ApiResponse<T> {
  code: number;
  status: "success" | "failed";
  message: string;
  data: T | null;
}

export type DashboardContentType = "post" | "note" | "page" | "recently";

export interface DashboardStats {
  posts: number;
  notes: number;
  pages: number;
  recently: number;
  comments: number;
  links: number;
  readers: number;
  totalContent: number;
}

export interface DashboardContent {
  _id: string;
  type: DashboardContentType;
  title: string;
  created: string;
}

export interface PublicationPoint {
  date: string;
  posts: number;
  notes: number;
  pages: number;
  recently: number;
}

export interface DashboardOverview {
  stats: DashboardStats;
  recentContent: DashboardContent[];
  publicationTrend: PublicationPoint[];
}

export const dashboardApi = {
  getOverview: async () => {
    const response = await request.get<ApiResponse<DashboardOverview>>(
      "/dashboard/overview",
      { bypassTransform: true },
    );
    if (response.data === null)
      throw new Error(response.message || "仪表盘数据为空");
    return response.data;
  },
};

