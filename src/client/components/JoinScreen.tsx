import { useEffect, useId, useState, type FormEvent } from "react";
import { CrewApiError, messageOf } from "../crew/api";
import type { CrewDirectory } from "../crew/contract";
import { useCrew } from "../crew/CrewProvider";
import { usingFixture } from "../crew/adapter";
import { Button } from "../ui/primitives";
import { IconShield } from "../ui/icons";

function crewCodeFromUrl() {
  const p = new URLSearchParams(window.location.search);
  return p.get("crew") ?? p.get("c") ?? "";
}

export function JoinScreen() {
  const { api, setSession } = useCrew();
  const [crewCode, setCrewCode] = useState(crewCodeFromUrl);
  const [codeDraft, setCodeDraft] = useState(crewCode || (usingFixture ? "demo" : ""));
  const [dir, setDir] = useState<CrewDirectory | null | undefined>(undefined);
  const [profile, setProfile] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errId = useId();

  useEffect(() => {
    if (!api || !crewCode) return;
    let live = true;
    setDir(undefined);
    setError(null);
    api
      .directory(crewCode)
      .then((d) => live && setDir(d))
      .catch((err) => {
        if (!live) return;
        setError(messageOf(err));
        setDir(null);
      });
    return () => {
      live = false;
    };
  }, [api, crewCode]);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    if (!api || !profile.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.join({ crewCode, profileCode: profile.trim() });
      setSession({ ...r, crewCode });
    } catch (err) {
      setError(messageOf(err));
      if (err instanceof CrewApiError && err.status === 409) {
        setProfile("");
        api.directory(crewCode).then(setDir).catch(() => {});
      }
    } finally {
      setBusy(false);
    }
  };

  if (!crewCode) {
    return (
      <main className="cr-join">
        <form
          className="cr-join__panel"
          onSubmit={(e) => {
            e.preventDefault();
            if (codeDraft.trim()) setCrewCode(codeDraft.trim());
          }}
        >
          <p className="cr-wordmark">Crew Radio</p>
          <h1 className="cr-join__title">Join your crew</h1>
          <label className="cr-field">
            <span className="cr-field__label">Crew code</span>
            <input
              className="cr-input"
              value={codeDraft}
              onChange={(e) => setCodeDraft(e.target.value)}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <span className="cr-field__hint">It's on the QR code or the link you were sent.</span>
          </label>
          <Button tone="primary" block type="submit">
            Continue
          </Button>
        </form>
      </main>
    );
  }

  return (
    <main className="cr-join">
      <form className="cr-join__panel" onSubmit={join} aria-describedby={error ? errId : undefined}>
        <p className="cr-wordmark">Crew Radio</p>
        <h1 className="cr-join__title">
          {dir?.crewName ? `Join ${dir.crewName}` : "Join your crew"}
        </h1>

        {dir === undefined && !error && <p className="cr-muted">Loading profiles…</p>}

        {dir && (
          <fieldset className="cr-profiles">
            <legend className="cr-field__label">Who are you?</legend>
            {dir.profiles.map((p) => (
              <label
                key={p.profileCode}
                className={`cr-profile${p.claimed ? " is-claimed" : ""}`}
              >
                <input
                  type="radio"
                  name="profile"
                  value={p.profileCode}
                  checked={profile === p.profileCode}
                  disabled={p.claimed}
                  onChange={() => setProfile(p.profileCode)}
                />
                <span className="cr-profile__name">{p.name}</span>
                <span className="cr-profile__meta">
                  {p.claimed ? "Already joined on another device" : p.skills.join(", ")}
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {dir === null && (
          <label className="cr-field">
            <span className="cr-field__label">Profile code</span>
            <input
              className="cr-input"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              autoCapitalize="none"
              autoComplete="off"
              required
            />
          </label>
        )}

        {error && (
          <p id={errId} className="cr-inline-alert" role="alert">
            {error}
          </p>
        )}

        <Button tone="primary" block type="submit" busy={busy} busyLabel="Joining…" disabled={!profile}>
          Join
        </Button>

        <p className="cr-join__foot">
          <IconShield size={15} /> Your microphone is only used after you tap Talk.
        </p>
        <button type="button" className="cr-link" onClick={() => setCrewCode("")}>
          Use a different crew code
        </button>
      </form>
    </main>
  );
}
