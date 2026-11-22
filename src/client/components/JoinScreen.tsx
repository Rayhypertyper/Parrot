import { useEffect, useId, useState, type FormEvent } from "react";
import { CrewApiError, messageOf } from "../crew/api";
import type { CrewDirectory } from "../crew/contract";
import { useCrew } from "../crew/CrewProvider";
import { usingFixture } from "../crew/adapter";
import { Button } from "../ui/primitives";
import { IconShield } from "../ui/icons";
import { Wordmark } from "../ui/Wordmark";

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
      const r = await api.join({ crewCode, profileCode: profile.trim().toLowerCase() });
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

  return (
    <div className="cr-join">
      <header className="cr-join__bar">
        <Wordmark />
      </header>

      <main className="cr-join__body">
        <section className="cr-join__panel" aria-labelledby="join-title">
          {!crewCode ? (
            <form
              className="cr-join__form"
              onSubmit={(e) => {
                e.preventDefault();
                if (codeDraft.trim()) setCrewCode(codeDraft.trim());
              }}
            >
              <h1 id="join-title" className="cr-display cr-join__title">
                Tune in to your crew
              </h1>
              <p className="cr-join__lede">
                Enter the crew code from the QR poster or the link your organizer sent.
              </p>
              <label className="cr-field">
                <span className="cr-field__label">Crew code</span>
                <input
                  className="cr-input cr-input--code"
                  value={codeDraft}
                  onChange={(e) => setCodeDraft(e.target.value)}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
              </label>
              <Button tone="primary" block type="submit">
                Continue
              </Button>
            </form>
          ) : (
            <form
              className="cr-join__form"
              onSubmit={join}
              aria-describedby={error ? errId : undefined}
            >
              <div className="cr-channel">
                <span className="cr-channel__label">Crew code</span>
                <span className="cr-channel__code">{crewCode}</span>
                <button type="button" className="cr-channel__change" onClick={() => setCrewCode("")}>
                  Change
                </button>
              </div>

              <h1 id="join-title" className="cr-display cr-join__title">
                {dir?.crewName ? `Join ${dir.crewName}` : "Join your crew"}
              </h1>
              <p className="cr-join__lede">
                {dir === null
                  ? "Enter the profile code your organizer gave you. This device stays signed in until you leave."
                  : "Choose who you are on this device. It stays signed in until you leave."}
              </p>

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
                      <span className="cr-profile__initial" aria-hidden="true">
                        {p.name.slice(0, 1)}
                      </span>
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
                  <span className="cr-field__label">Your profile code</span>
                  <input
                    className="cr-input cr-input--code"
                    value={profile}
                    onChange={(e) => setProfile(e.target.value)}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    required
                  />
                </label>
              )}

              {error && (
                <p id={errId} className="cr-inline-alert" role="alert">
                  {error}
                </p>
              )}

              <Button
                tone="primary"
                block
                type="submit"
                busy={busy}
                busyLabel="Joining…"
                disabled={!profile.trim()}
              >
                Join
              </Button>

              <p className="cr-join__foot">
                <IconShield size={15} /> Your microphone stays off until you tap Talk.
              </p>
            </form>
          )}
        </section>

        <aside className="cr-join__how" aria-label="How Crew Radio works">
          <p className="cr-display cr-join__how-title">One radio for the whole crew</p>
          <ol className="cr-steps">
            <li>
              <span className="cr-steps__n">1</span>
              <span>
                <strong>Ask out loud or type it.</strong> Say what you need and where.
              </span>
            </li>
            <li>
              <span className="cr-steps__n">2</span>
              <span>
                <strong>The right person gets the offer.</strong> Declines carry new details to
                the next teammate.
              </span>
            </li>
            <li>
              <span className="cr-steps__n">3</span>
              <span>
                <strong>Delivered, then confirmed.</strong> Every screen shows who has it.
              </span>
            </li>
          </ol>
        </aside>
      </main>
    </div>
  );
}
