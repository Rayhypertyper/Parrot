import { config } from "wasp/client";
import { CrewApiError, type CrewApi } from "./api";
import {
  crewRoutes,
  type CrewDirectory,
  type CrewEventResult,
  type Feed,
  type JoinResult,
  type RetryPlanResult,
  type VoiceSession,
} from "./contract";

const base = () => config.apiUrl.replace(/\/$/, "");

async function call<T>(
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.token) headers.Authorization = `Bearer ${init.token}`;

  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new CrewApiError(
      "Can't reach the crew server. Check your connection.",
      0,
    );
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }
  if (!res.ok) {
    const message =
      data?.message ?? data?.error ?? `Request failed (${res.status}).`;
    throw new CrewApiError(String(message), res.status, data?.code);
  }
  return data as T;
}

export const httpAdapter: CrewApi = {
  kind: "http",

  async directory(crewCode) {
    try {
      return await call<CrewDirectory>(
        `/crew/profiles?crewCode=${encodeURIComponent(crewCode)}`,
      );
    } catch (err) {
      // Route not published yet: the join screen falls back to a typed code.
      if (err instanceof CrewApiError && err.status === 404) return null;
      throw err;
    }
  },

  join: (body) => call<JoinResult>(crewRoutes.join, { method: "POST", body }),

  feed: (token) => call<Feed>(crewRoutes.feed, { token }),

  sendEvent: (token, body) =>
    call<CrewEventResult>(crewRoutes.events, { method: "POST", token, body }),

  retryPlan: (token, requestId) =>
    call<RetryPlanResult>(crewRoutes.retryPlan, {
      method: "POST",
      token,
      body: { requestId },
    }),

  voiceSession: (token, body) =>
    call<VoiceSession>(crewRoutes.voiceSession, { method: "POST", token, body }),
};
