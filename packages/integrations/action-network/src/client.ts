const BASE_URL = "https://actionnetwork.org/api/v2";

// Action Network caps clients at 4 req/s; this token bucket keeps us under that
// without callers having to think about pacing.
class RateLimiter {
  private tokens: number;
  private queue: Array<() => void> = [];

  constructor(private readonly maxPerSecond: number) {
    this.tokens = maxPerSecond;
    setInterval(() => {
      this.tokens = this.maxPerSecond;
      this.drain();
    }, 1000).unref();
  }

  private drain() {
    while (this.tokens > 0 && this.queue.length > 0) {
      this.tokens -= 1;
      this.queue.shift()?.();
    }
  }

  acquire(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
      this.drain();
    });
  }
}

export interface ActionNetworkPerson {
  identifiers?: string[];
  email_addresses?: Array<{ address: string; primary?: boolean }>;
  phone_numbers?: Array<{ number: string; primary?: boolean }>;
  given_name?: string;
  family_name?: string;
  custom_fields?: Record<string, unknown>;
  modified_date?: string;
  [key: string]: unknown;
}

export class ActionNetworkClient {
  private readonly rateLimiter = new RateLimiter(4);

  constructor(private readonly apiKey: string) {}

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    await this.rateLimiter.acquire();
    const res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "OSDI-API-Token": this.apiKey,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (!res.ok) {
      throw new Error(`Action Network API error ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async getPeople(params: { modifiedSince?: Date; page?: number } = {}) {
    const query = new URLSearchParams();
    if (params.modifiedSince) {
      query.set("filter", `modified_date gt '${params.modifiedSince.toISOString()}'`);
    }
    if (params.page) query.set("page", String(params.page));
    return this.request<{ _embedded: { "osdi:people": ActionNetworkPerson[] } }>(
      `/people?${query.toString()}`
    );
  }

  async upsertPerson(person: ActionNetworkPerson) {
    return this.request<ActionNetworkPerson>("/people", {
      method: "POST",
      body: JSON.stringify({ person }),
    });
  }
}
