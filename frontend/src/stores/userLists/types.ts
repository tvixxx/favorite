import type { MovieApiResponse } from "@/stores/movies/types/movies.types";

export interface UserListCount {
  items: number;
}

export interface UserListSummary {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  _count: UserListCount;
}

export interface UserListItem {
  id: string;
  listId: string;
  movieId: string;
  addedAt: string;
  createdAt: string;
  updatedAt: string;
  movie: MovieApiResponse;
}

export interface UserListDetail {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  items: UserListItem[];
}

export interface CreateUserListPayload {
  name: string;
  description?: string;
  labels?: string[];
}

export interface UpdateUserListPayload {
  name?: string;
  description?: string;
  labels?: string[];
}
