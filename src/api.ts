import type { Workspace } from "./types";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers }
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.message || `Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export const api = {
  workspace: () => request<Workspace>("/api/workspace"),
  saveWorkspace: (data: Omit<Workspace, "topics">) => request<Workspace>("/api/workspace", { method: "PUT", body: JSON.stringify(data) }),
  generatePlan: () => request<Workspace>("/api/plan", { method: "POST" }),
  advanceTopic: (id: string) => request<Workspace>(`/api/topics/${id}/advance`, { method: "POST" })
};
