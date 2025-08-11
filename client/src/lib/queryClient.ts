import { QueryClient, QueryFunction } from "@tanstack/react-query";

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
  const res = await fetch(fullUrl, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

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
    const res = await fetch(fullUrl, {
      credentials: "include",
    });

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
