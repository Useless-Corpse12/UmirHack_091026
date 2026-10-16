import {
  publicClient,
  commitSession,
  resetSession,
  sessionGeneration,
} from "./axios";
import { apiConfig, endpoints } from "./config";
import { sessionFromToken } from "../lib/token";
import { ApiError } from "./errors";
import { storage } from "../lib/storage";
import type { Credentials, User } from "../types/models";

export const authApi = {
  async register(credentials: Credentials) {
    const { data } = await publicClient.post<{
      userId: string;
      message: string;
      devVerificationCode?: string;
    }>(endpoints.register, credentials);
    storage.setPendingEmail(
      credentials.email,
      apiConfig.mode === "mock" ? data.devVerificationCode : undefined,
    );
    return data;
  },
  async verify(email: string, verificationCode: string) {
    await publicClient.post(endpoints.verify, { email, verificationCode });
    storage.clearPendingEmail();
  },
  async resend(email: string) {
    const { data } = await publicClient.post<{ devVerificationCode?: string }>(
      endpoints.resend,
      { email },
    );
    storage.setPendingEmail(
      email,
      apiConfig.mode === "mock" ? data.devVerificationCode : undefined,
    );
    return data;
  },
  async login(credentials: Credentials) {
    const generation = resetSession();
    const { data } = await publicClient.post<{
      accessToken: string;
      user?: User;
    }>(endpoints.login, credentials);
    if (sessionGeneration() !== generation)
      throw new ApiError(0, "CANCELLED", "Сессия изменилась");
    const session = sessionFromToken(
      data.accessToken,
      apiConfig.mode,
      data.user,
    );
    commitSession(session);
    return session;
  },
  async logout() {
    const token = storage.getAccessToken();
    resetSession();
    if (apiConfig.logoutPath && token) {
      try {
        await publicClient.post(
          apiConfig.logoutPath,
          {},
          { headers: { Authorization: "Bearer " + token } },
        );
      } catch {
        /* Local logout remains effective while offline. */
      }
    }
  },
};
