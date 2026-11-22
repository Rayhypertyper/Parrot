// Member session storage. sessionStorage keeps each tab's identity through a
// refresh; localStorage lets a returning device (or the board in a new tab)
// restore the last member who joined here.
const KEY = "crew-radio:member";

export interface StoredSession {
  memberToken: string;
  memberId: string;
  crewId: string;
  crewCode: string;
}

function read(store: Storage | undefined): StoredSession | null {
  try {
    const raw = store?.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export function loadSession(): StoredSession | null {
  return read(safe(() => sessionStorage)) ?? read(safe(() => localStorage));
}

export function saveSession(s: StoredSession) {
  for (const store of [safe(() => sessionStorage), safe(() => localStorage)]) {
    try {
      store?.setItem(KEY, JSON.stringify(s));
    } catch {
      /* private mode: the session lasts as long as the page */
    }
  }
}

export function clearSession() {
  for (const store of [safe(() => sessionStorage), safe(() => localStorage)]) {
    try {
      store?.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}

// Event IDs for intents the user started, so a retry after a refresh or a
// dropped response reuses the same ID instead of creating a second event.
const INTENT = "crew-radio:intent:";

export function intentId(key: string): string {
  const store = safe(() => sessionStorage);
  try {
    const existing = store?.getItem(INTENT + key);
    if (existing) return existing;
  } catch {
    /* ignore */
  }
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  try {
    store?.setItem(INTENT + key, id);
  } catch {
    /* ignore */
  }
  return id;
}

export function clearIntent(key: string) {
  try {
    safe(() => sessionStorage)?.removeItem(INTENT + key);
  } catch {
    /* ignore */
  }
}

function safe<T>(get: () => T): T | undefined {
  try {
    return get();
  } catch {
    return undefined;
  }
}
