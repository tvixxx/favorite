import type { MaybeRefOrGetter } from "@vueuse/core";
import { toValue } from "vue";
import api from "@/services/api";
import type { AppEndpoints } from "@/constants/api/endpoints";

export enum FETCH_METHOD {
  get = "GET",
  post = "POST",
  patch = "PATCH",
  delete = "DELETE",
  put = "PUT",
}

export interface FetchOptions {
  method?: FETCH_METHOD;
  data?: unknown;
}

export type UseFetchResult<T> = {
  data: T;
  status: number;
};

export async function useFetch<T = unknown>(
  url: MaybeRefOrGetter<AppEndpoints>,
  options: FetchOptions = {}
): Promise<UseFetchResult<T>> {
  const urlValue = toValue(url);

  let response;

  switch (options.method) {
    case FETCH_METHOD.post:
      response = await api.post<T>(urlValue, options.data);
      break;
    case FETCH_METHOD.delete:
      response = await api.delete<T>(urlValue);
      break;
    case FETCH_METHOD.patch:
      response = await api.patch<T>(urlValue, options.data);
      break;
    case FETCH_METHOD.put:
      response = await api.put<T>(urlValue, options.data);
      break;
    case FETCH_METHOD.get:
    default:
      response = await api.get<T>(urlValue);
  }

  return {
    data: response.data,
    status: response.status,
  };
}
