/**
 * The ONE way the app talks to the server: a base URL, a timeout, and
 * clear errors (offline / timeout / server said no).
 *
 * Address: VITE_API_URL if set; while developing (Vite on :5173) the local
 * server on :4000; otherwise the computer the app was opened from — the
 * installed app and other counters on the shop network load the screens
 * from the server itself.
 */
function defaultApiUrl(): string {
  const loc = typeof window === "undefined" ? undefined : window.location;
  if (!loc?.origin || loc.port === "5173")
    return "http://localhost:4000";
  return loc.origin;
}
export const API_URL = (
  import.meta.env.VITE_API_URL ?? defaultApiUrl()
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

/**
 * Sends one request; resolves the Response only when the server said OK.
 * A File/Blob body is sent as raw bytes (backup upload), anything else as JSON.
 */
async function send(
  method: Method,
  path: string,
  body: unknown,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const bytes = body instanceof Blob;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        ...(body === undefined
          ? {}
          : {
              "Content-Type": bytes
                ? "application/octet-stream"
                : "application/json",
            }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body:
        body === undefined
          ? undefined
          : bytes
            ? (body as Blob)
            : JSON.stringify(body),
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
  return res;
}

/** Any call to the server. 204 (no content) resolves to undefined. */
export async function apiRequest<T>(
  method: Method,
  path: string,
  body?: unknown,
  timeoutMs = 8000,
): Promise<T> {
  const res = await send(method, path, body, timeoutMs);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Save a file the server sends (e.g. a backup) to the computer's Downloads */
export async function apiDownload(path: string, fileName: string) {
  const res = await send("GET", path, undefined, 120_000);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const apiGet = <T>(path: string, timeoutMs?: number) =>
  apiRequest<T>("GET", path, undefined, timeoutMs);

/** Saving needs the database — refuse clearly when it isn't connected */
export function requireServer(source: "none" | "server") {
  if (source !== "server")
    throw new ApiError("Not connected to the server yet", "offline");
}
