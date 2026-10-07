/**
 * The ONE way the app talks to the server: a base URL, a timeout, and
 * clear errors (offline / timeout / server said no).
 * VITE_API_URL overrides the address (e.g. the main PC on the shop LAN).
 */
export const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:4000"
).replace(/\/+$/, "");

export class ApiError extends Error {
  readonly kind: "offline" | "timeout" | "http";
  readonly status?: number;
  constructor(message: string, kind: ApiError["kind"], status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

/**
 * Sign-in token, set by the auth store. Sent with every call; when the
 * server says 401 (signed out elsewhere, account switched off, expired)
 * the app goes back to the login screen.
 */
let token: string | null = null;
let onSignedOut: () => void = () => {};
export function setApiAuth(t: string | null, signedOut?: () => void) {
  token = t;
  if (signedOut) onSignedOut = signedOut;
}
export const apiToken = () => token;

/** Any call to the server. 204 (no content) resolves to undefined. */
export async function apiRequest<T>(
  method: Method,
  path: string,
  body?: unknown,
  timeoutMs = 8000,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw ctrl.signal.aborted
      ? new ApiError("The server took too long to answer", "timeout")
      : new ApiError("Server not reachable", "offline");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    if (res.status === 401 && token) onSignedOut();
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    throw new ApiError(
      typeof data.error === "string"
        ? data.error
        : `Server error ${res.status}`,
      "http",
      res.status,
    );
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const apiGet = <T>(path: string, timeoutMs?: number) =>
  apiRequest<T>("GET", path, undefined, timeoutMs);

/** Saving needs the database — refuse clearly when it isn't connected */
export function requireServer(source: "none" | "server") {
  if (source !== "server")
    throw new ApiError("Not connected to the server yet", "offline");
}
