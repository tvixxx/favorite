import type { MovieApiResponse, Review } from "@/stores/movies/types";

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: "USER" | "ADMIN";
  createdAt: string;
  blockedAt: string | null;
  blockedReason: string | null;
  _count: { userMovies: number; reviews: number };
}

export interface AdminMovie extends MovieApiResponse {
  createdBy: { fullName: string } | null;
  _count: {
    userMovies: number;
    reviews: number;
    actors: number;
    listItems: number;
  };
}

export interface AdminReview extends Review {
  updatedAt: string;
  hiddenAt: string | null;
  movie: { id: string; title: string };
  reports: { id: string; reason: string; comment: string | null }[];
  _count: { reports: number };
}

export interface AdminFeedback {
  id: string;
  type: string;
  message: string;
  email: string | null;
  pageUrl: string | null;
  viewport: string | null;
  userAgent: string | null;
  screenshotAssetId?: string | null;
  status: "NEW" | "IN_PROGRESS" | "DONE";
  createdAt: string;
  user: { fullName: string } | null;
}

export interface AdminEngagementData {
  activity: {
    dau: number;
    wau: number;
    mau: number;
    complete: { day: boolean; week: boolean; month: boolean };
  };
  funnel: { registered: number; collected: number; rated: number };
  retention: {
    week: string;
    registered: number;
    returned: number | null;
    percent: number | null;
    state: "empty" | "complete" | "collecting" | "insufficient";
  }[];
}
