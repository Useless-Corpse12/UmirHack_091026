import { ApiError } from "../api/errors.ts";
import type { DataMode, Session, User } from "../types/models";

// Decoding supplies client metadata only. Signature, expiry and roles are enforced by the server.
export function sessionFromToken(
  accessToken: string,
  dataMode: DataMode,
  suppliedUser?: User,
): Session {
  try {
    const parts = accessToken.split(".");
    if (parts.length !== 3) throw new Error();
    const bytes = Uint8Array.from(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
      (c) => c.charCodeAt(0),
    );
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    const id = claims.UserId || claims.userId || claims.sub;
    const email = claims.Email || claims.email;
    if (
      typeof id !== "string" ||
      typeof email !== "string" ||
      !Number.isFinite(claims.exp)
    )
      throw new Error();
    if (
      suppliedUser &&
      (suppliedUser.id !== id || suppliedUser.email !== email)
    )
      throw new Error();
    return {
      accessToken,
      user: { id, email },
      expiresAt: claims.exp * 1000,
      dataMode,
    };
  } catch {
    throw new ApiError(0, "INVALID_TOKEN", "Сервер вернул некорректный JWT");
  }
}
