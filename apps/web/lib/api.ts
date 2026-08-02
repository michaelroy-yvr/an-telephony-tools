const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (res.status === 204) return undefined as T;

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }

  return res.json() as Promise<T>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "campaign_manager" | "agent";
}

export interface Contact {
  id: string;
  phone: string;
  firstName: string | null;
  lastName: string | null;
}

export interface Campaign {
  id: string;
  name: string;
  listId: string;
  status: "draft" | "active" | "paused" | "completed";
  createdAt: string;
}

export interface MessageTemplate {
  id: string;
  label: string;
  body: string;
}

export interface CampaignDetail extends Campaign {
  templates: MessageTemplate[];
}
