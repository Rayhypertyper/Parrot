import { useEffect, type ReactNode } from "react";
import "./crew-radio.css";
import { usingFixture } from "./crew/adapter";
import { CrewProvider, useCrew } from "./crew/CrewProvider";
import type { Feed } from "./crew/contract";
import { JoinScreen } from "./components/JoinScreen";
import { VoiceProvider } from "./voice/VoiceProvider";
import { Wordmark } from "./ui/Wordmark";

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

/** Shared providers + session gate for both page routes. */
export function CrewShell({ children }: { children: (feed: Feed) => ReactNode }) {
  return (
    <CrewProvider>
      <VoiceProvider>
        <div className="cr-root">
          {usingFixture && <FixtureStrip />}
          <Gate>{children}</Gate>
        </div>
      </VoiceProvider>
    </CrewProvider>
  );
}

function Gate({ children }: { children: (feed: Feed) => ReactNode }) {
  const { session, feed, link } = useCrew();
  if (!session) return <JoinScreen />;
  if (!feed)
    return (
      <main className="cr-loading" aria-busy="true">
        <Wordmark size="lg" />
        <p className="cr-muted">
          {link === "offline" ? "Can't reach the crew server. Retrying…" : "Loading your crew…"}
        </p>
      </main>
    );
  return <>{children(feed)}</>;
}

function FixtureStrip() {
  const { leave } = useCrew();
  return (
    <div className="cr-fixture-strip" role="note">
      Sample data in this browser only. Not connected to the crew server.
      <button
        className="cr-link"
        onClick={async () => {
          const m = await import("./crew/fixtures/fixtureAdapter");
          m.resetFixture();
          leave();
          window.location.reload();
        }}
      >
        Reset sample crew
      </button>
    </div>
  );
}
