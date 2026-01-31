import type { MaybeRefOrGetter } from "@vueuse/core";
import { toValue } from "vue";
import api from "@/services/api";
import type { AppEndpoints } from "@/constants/api/endpoints";
import { useAuthToken } from "@/composable/useAuthToken";

export enum FETCH_METHOD {
  get = "GET",
  post = "POST",
  patch = "PATCH",
  delete = "DELETE",
}

export interface FetchOptions {
  method?: FETCH_METHOD;
  data?: any;
}

export type UseFetchResult = {
  data: any;
  status: number;
  token?: string | null;
};

export async function useFetch(
  url: MaybeRefOrGetter<AppEndpoints>,
  options: FetchOptions = {}
): Promise<UseFetchResult> {
  const token = useAuthToken().value;
  const urlValue = toValue(url);

  let response;

  switch (options.method) {
    case FETCH_METHOD.post:
      response = await api.post(urlValue, options.data);
      break;
    case FETCH_METHOD.delete:
      response = await api.delete(urlValue);
      break;
    case FETCH_METHOD.patch:
      response = await api.patch(urlValue, options.data);
      break;
    case FETCH_METHOD.get:
    default:
      response = await api.get(urlValue);
  }

  return {
    data: response.data,
    status: response.status,
    token: token ?? response.data.accessToken,
  };
}
