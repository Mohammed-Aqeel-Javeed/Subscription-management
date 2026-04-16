import { QueryClient, QueryFunction } from "@tanstack/react-query";

const DEFAULT_TIMEOUT_MS = 20_000;

function normalizeToken(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/^Bearer\s+/i, "");
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Prefer per-tab token. If absent, rely on cookie auth via credentials: include.
  const token = normalizeToken(String(sessionStorage.getItem("token") || ""));
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    cache: "no-store",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

function getTokenFromStorageOrCookie(): string {
  // Only use per-tab storage. Cookies are HTTP-only and not readable from JS.
  return normalizeToken(String(sessionStorage.getItem("token") || ""));
}

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers = new Headers();
    const token = getTokenFromStorageOrCookie();
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
      cache: "no-store",
      headers,
      signal: controller.signal,
    }).finally(() => window.clearTimeout(timeoutId));

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      staleTime: 2 * 60 * 1000, // 2 minutes default - queries stay fresh
      gcTime: 10 * 60 * 1000, // 10 minutes garbage collection
      retry: (failureCount, error) => {
        const msg = (error as any)?.message ? String((error as any).message) : "";
        if (/^(401|403)\b/.test(msg) || msg === "Unauthorized") return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10_000),
    },
    mutations: {
      retry: false,
    },
  },
});
