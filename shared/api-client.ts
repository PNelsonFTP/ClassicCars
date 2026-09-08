import type { Listing, Snapshot, Search } from "./schema";
export type ApiClient = <T = unknown>(
  path: string,
  options?: RequestInit,
) => Promise<T>;
export type SearchPage = {
  rows: Listing[];
  rawCount: number;
  groupCount: number;
  total: number;
  offset: number;
  nextOffset: number | null;
};
export type ProvenancePage = {
  current: Record<string, unknown>;
  source?: Record<string, unknown>;
  override?: { reason?: string; reviewedAt: string };
  events: {
    id: string;
    kind: string;
    observedAt: string;
    evidence: Record<string, unknown>;
  }[];
  total: number;
  nextOffset: number | null;
};
export async function apiRequest<T>(
  backend: string,
  token: string,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${backend.replace(/\/$/, "")}${path}`, {
    ...options,
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const payload = await response.json();
  if (!response.ok)
    throw Object.assign(
      new Error(payload.error || `Request failed (${response.status})`),
      { status: response.status },
    );
  return payload as T;
}
export const getSnapshot = (api: ApiClient) => api<Snapshot>("/api/snapshot");
export const getSearchPage = (
  api: ApiClient,
  filters: Search,
  offset = 0,
  limit = 48,
) =>
  api<SearchPage>("/api/search/page", {
    method: "POST",
    body: JSON.stringify({ filters, offset, limit }),
  });
