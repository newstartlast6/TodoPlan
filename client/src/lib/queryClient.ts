import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAccessToken, authEnabledOnClient } from "./supabaseClient";

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
  const fullUrl = resolveApiUrl(url);
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (authEnabledOnClient) {
    try {
      const token = await getAccessToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch {}
  }
  let res = await fetch(fullUrl, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Retry once after a possible token refresh
  if (res.status === 401 && authEnabledOnClient) {
    try {
      const token = await getAccessToken();
      const retryHeaders = { ...headers };
      if (token) retryHeaders["Authorization"] = `Bearer ${token}`;
      res = await fetch(fullUrl, {
        method,
        headers: retryHeaders,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    } catch {}
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = Array.isArray(queryKey) ? (queryKey[0] as string) : (queryKey as unknown as string);
    const fullUrl = resolveApiUrl(url);
    const headers: Record<string, string> = {};
    if (authEnabledOnClient) {
      try {
        const token = await getAccessToken();
        if (token) headers["Authorization"] = `Bearer ${token}`;
      } catch {}
    }
    let res = await fetch(fullUrl, {
      credentials: "include",
      headers,
    });

    if (res.status === 401 && authEnabledOnClient) {
      try {
        const token = await getAccessToken();
        const retryHeaders = { ...headers };
        if (token) retryHeaders["Authorization"] = `Bearer ${token}`;
        res = await fetch(fullUrl, {
          credentials: "include",
          headers: retryHeaders,
        });
      } catch {}
    }

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
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

function resolveApiUrl(inputUrl: string): string {
  // Absolute URLs pass through
  if (/^https?:\/\//i.test(inputUrl)) return inputUrl;

  // If running inside Electron, use preload-provided base URL
  const anyWindow = window as any;
  let electronApiBase: string | undefined;
  try {
    electronApiBase = anyWindow?.electronAPI?.getApiBaseUrl?.();
  } catch {}

  // Prefer Vite dev proxy during development to avoid CORS
  const isHttpPage = typeof window !== 'undefined' && /^https?:/i.test(window.location.protocol);
  const isFilePage = typeof window !== 'undefined' && window.location.protocol === 'file:';
  const isDev = typeof import.meta !== 'undefined' && (import.meta as any)?.env?.DEV;

  if (electronApiBase && inputUrl.startsWith("/") && (isFilePage || !isHttpPage || !isDev)) {
    // electronApiBase is like http://localhost:5002/api
    const origin = electronApiBase.replace(/\/?api\/?$/, "");
    return origin + inputUrl;
  }

  // Fallback: use same-origin
  return inputUrl;
}
