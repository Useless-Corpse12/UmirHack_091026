import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { storage } from "../lib/storage";
import { apiConfig } from "./config";
import { toApiError } from "./errors";
import type { Session } from "../types/models";
const options = {
  baseURL: apiConfig.baseURL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
};
export const publicClient = axios.create(options);
export const axiosInstance = axios.create(options);
let onSessionChanged: (session: Session | null) => void = () => {};
let generation = 0;
export const observeSession = (callback: typeof onSessionChanged) => {
  onSessionChanged = callback;
};
export const sessionGeneration = () => generation;
export function commitSession(session: Session | null) {
  if (session) storage.writeSession(session);
  else storage.clearAccessToken();
  onSessionChanged(session);
}
export function resetSession() {
  generation += 1;
  commitSession(null);
  return generation;
}
type RequestConfig = InternalAxiosRequestConfig & {
  _sessionGeneration?: number;
};
axiosInstance.interceptors.request.use((config: RequestConfig) => {
  config._sessionGeneration = generation;
  const token = storage.getAccessToken();
  if (token) config.headers.Authorization = "Bearer " + token;
  return config;
});
axiosInstance.interceptors.response.use(
  (response) => response,
  (err) => {
    const config = err.config as RequestConfig | undefined;
    // A response from an old account may not end a newer session.
    if (
      err.response?.status === 401 &&
      config?._sessionGeneration === generation
    )
      resetSession();
    return Promise.reject(toApiError(err));
  },
);
publicClient.interceptors.response.use(
  (r) => r,
  (err) => Promise.reject(toApiError(err)),
);
