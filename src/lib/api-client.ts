/** Browser-side caller for the JSON envelope every API route returns. */
export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export async function api<T = unknown>(url: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: opts.method ?? (opts.body !== undefined || opts.form ? "POST" : "GET"),
      headers: opts.form ? undefined : { "Content-Type": "application/json" },
      body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
    });
    if (res.status === 401) {
      // Session expired: a full page load clears client state before signing in again.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
      return { ok: false, error: { code: "UNAUTHENTICATED", message: "Please sign in again." } };
    }
    const json = (await res.json().catch(() => null)) as ApiResult<T> | null;
    if (!json) return { ok: false, error: { code: "INTERNAL", message: "The server sent an unexpected reply." } };
    return json;
  } catch {
    return { ok: false, error: { code: "NETWORK", message: "Could not reach the server. Check your connection and try again." } };
  }
}
