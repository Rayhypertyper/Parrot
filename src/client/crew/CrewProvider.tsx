import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CrewApiError, messageOf, type CrewApi } from "./api";
import { getCrewApi } from "./adapter";
import type { CrewEventResult, EventKind, Feed } from "./contract";
import {
  clearIntent,
  clearSession,
  intentId,
  loadSession,
  saveSession,
  type StoredSession,
} from "./session";

const POLL_VISIBLE_MS = 2000;
const POLL_HIDDEN_MS = 10000;

export type Link = "live" | "syncing" | "offline";

export interface Notice {
  tone: "ok" | "warn" | "error";
  text: string;
  at: number;
}

export interface ActInput {
  kind: EventKind;
  requestId?: string;
  offerId?: string;
  text?: string;
  location?: string;
  availability?: "available" | "busy";
}

interface CrewContextValue {
  api: CrewApi | null;
  session: StoredSession | null;
  feed: Feed | null;
  link: Link;
  notice: Notice | null;
  pending: Record<string, boolean>;
  setSession: (s: StoredSession) => void;
  leave: () => void;
  refresh: () => Promise<void>;
  act: (input: ActInput) => Promise<CrewEventResult | null>;
  retryPlan: (requestId: string) => Promise<void>;
  say: (n: Omit<Notice, "at"> | null) => void;
}

const CrewContext = createContext<CrewContextValue | null>(null);

export function intentKey(i: Pick<ActInput, "kind" | "requestId" | "offerId">) {
  return `${i.kind}:${i.offerId ?? i.requestId ?? "new"}`;
}

export function CrewProvider({ children }: { children: ReactNode }) {
  const [api, setApi] = useState<CrewApi | null>(null);
  const [session, setSessionState] = useState<StoredSession | null>(() =>
    loadSession(),
  );
  const [feed, setFeed] = useState<Feed | null>(null);
  const [link, setLink] = useState<Link>("syncing");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const inflight = useRef<Promise<void> | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    getCrewApi().then(setApi);
  }, []);

  const say = useCallback((n: Omit<Notice, "at"> | null) => {
    setNotice(n ? { ...n, at: Date.now() } : null);
  }, []);

  const leave = useCallback(() => {
    clearSession();
    setSessionState(null);
    setFeed(null);
  }, []);

  const setSession = useCallback((s: StoredSession) => {
    saveSession(s);
    setSessionState(s);
  }, []);

  const refresh = useCallback(async () => {
    const s = sessionRef.current;
    if (!api || !s) return;
    if (inflight.current) return inflight.current;
    inflight.current = (async () => {
      try {
        const next = await api.feed(s.memberToken);
        if (sessionRef.current?.memberToken !== s.memberToken) return;
        setFeed(next);
        setLink("live");
      } catch (err) {
        if (err instanceof CrewApiError && err.isUnauthorized) {
          leave();
          say({ tone: "warn", text: "Your session ended. Join the crew again." });
        } else {
          setLink("offline");
        }
      } finally {
        inflight.current = null;
      }
    })();
    return inflight.current;
  }, [api, leave, say]);

  // Poll while the page is open; slower in the background, immediate on return.
  useEffect(() => {
    if (!api || !session) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      await refresh();
      if (stopped) return;
      timer = setTimeout(
        tick,
        document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS,
      );
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        tick();
      }
    };
    tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [api, session, refresh]);

  const act = useCallback(
    async (input: ActInput) => {
      const s = sessionRef.current;
      if (!api || !s) return null;
      const key = intentKey(input);
      if (pending[key]) return null;
      setPending((p) => ({ ...p, [key]: true }));
      try {
        const result = await api.sendEvent(s.memberToken, {
          eventId: intentId(key),
          ...input,
        });
        clearIntent(key);
        say({ tone: "ok", text: result.message });
        await refresh();
        return result;
      } catch (err) {
        if (err instanceof CrewApiError && err.isStale) {
          clearIntent(key);
          say({ tone: "warn", text: err.message });
          await refresh();
        } else if (err instanceof CrewApiError && err.isUnauthorized) {
          leave();
          say({ tone: "warn", text: err.message });
        } else {
          // A dropped connection may have committed: keep the event ID so the
          // retry is deduplicated. A rejected input gets a fresh ID next time.
          const dropped = err instanceof CrewApiError && err.isNetwork;
          if (!dropped) clearIntent(key);
          say({ tone: "error", text: messageOf(err) });
        }
        return null;
      } finally {
        setPending((p) => {
          const { [key]: _done, ...rest } = p;
          return rest;
        });
      }
    },
    [api, pending, refresh, leave, say],
  );

  const retryPlan = useCallback(
    async (requestId: string) => {
      const s = sessionRef.current;
      if (!api || !s) return;
      const key = `retry:${requestId}`;
      setPending((p) => ({ ...p, [key]: true }));
      try {
        const r = await api.retryPlan(s.memberToken, requestId);
        say({ tone: r.result === "failed" || r.result === "waiting" ? "warn" : "ok", text: r.message });
        await refresh();
      } catch (err) {
        say({ tone: err instanceof CrewApiError && err.isStale ? "warn" : "error", text: messageOf(err) });
        await refresh();
      } finally {
        setPending((p) => {
          const { [key]: _done, ...rest } = p;
          return rest;
        });
      }
    },
    [api, refresh, say],
  );

  const value = useMemo(
    () => ({
      api,
      session,
      feed,
      link,
      notice,
      pending,
      setSession,
      leave,
      refresh,
      act,
      retryPlan,
      say,
    }),
    [api, session, feed, link, notice, pending, setSession, leave, refresh, act, retryPlan, say],
  );

  return <CrewContext.Provider value={value}>{children}</CrewContext.Provider>;
}

export function useCrew() {
  const ctx = useContext(CrewContext);
  if (!ctx) throw new Error("useCrew must be used inside CrewProvider");
  return ctx;
}
