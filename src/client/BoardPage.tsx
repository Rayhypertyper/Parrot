import { useState } from "react";
import { CrewShell } from "./CrewShell";
import type { Feed } from "./crew/contract";
import { useCrew } from "./crew/CrewProvider";
import { ago, isActive, memberById, pendingOffers } from "./crew/derive";
import { AskForm } from "./components/AskForm";
import {
  ActivityList,
  AvailabilityControl,
  CrewList,
  HandoffActions,
  LinkStatus,
  NoticeBar,
  OfferCard,
  RequestHistory,
  RequestSummary,
} from "./components/CrewParts";
import { StatusBadge } from "./ui/primitives";
import { IconFlag, IconPhone, IconPin } from "./ui/icons";
import { TalkKey } from "./voice/TalkKey";
import { useVoice } from "./voice/VoiceProvider";
import { VoiceSheet } from "./voice/VoiceSheet";
import { voiceSubjects } from "./voice/subjects";

export function BoardPage() {
  return <CrewShell>{(feed) => <Board feed={feed} />}</CrewShell>;
}

export default BoardPage;

function Board({ feed }: { feed: Feed }) {
  const voice = useVoice();
  const { leave } = useCrew();
  const active = feed.requests.filter(isActive);
  const done = feed.requests.filter((r) => !isActive(r));
  const [picked, setPicked] = useState<string | null>(null);
  const selected =
    feed.requests.find((r) => r.id === picked) ?? active[0] ?? done[0] ?? null;
  const offers = pendingOffers(feed);

  return (
    <div className="cr-board">
      <header className="cr-board__bar">
        <div className="cr-board__crew">
          <p className="cr-wordmark">Crew Radio</p>
          <h1 className="cr-board__name">{feed.crewName ?? "Crew board"}</h1>
          <LinkStatus detailed />
        </div>
        <div className="cr-board__ask">
          <AskForm compact id="board-ask" />
        </div>
        <div className="cr-board__me">
          <div className="cr-board__who">
            <span className="cr-me__name">{feed.me.name}</span>
            <AvailabilityControl me={feed.me} />
          </div>
          <TalkKey size="md" onPress={() => voice.open(voiceSubjects(feed)[0])} />
          <a className="cr-icon-btn" href="/" aria-label="Open the phone view">
            <IconPhone size={20} />
          </a>
        </div>
      </header>

      <NoticeBar />

      <main className="cr-board__grid">
        <section className="cr-pane cr-pane--list" aria-labelledby="req-h">
          <h2 id="req-h" className="cr-pane__title">
            Active requests <span className="cr-count">{active.length}</span>
          </h2>
          {offers.map(({ offer, request }) => (
            <OfferCard key={offer.id} feed={feed} offer={offer} request={request} />
          ))}
          {active.length === 0 && (
            <div className="cr-empty cr-empty--board">
              <h3 className="cr-empty__title">No open requests</h3>
              <p className="cr-muted">Ask for help above, or tap Talk and say what you need and where.</p>
            </div>
          )}
          <div className="cr-req-list">
            {active.map((r) => (
              <RequestSummary
                key={r.id}
                feed={feed}
                request={r}
                selected={selected?.id === r.id}
                onSelect={() => setPicked(r.id)}
              />
            ))}
          </div>
          {done.length > 0 && (
            <details className="cr-done">
              <summary>Done ({done.length})</summary>
              <div className="cr-req-list">
                {done.map((r) => (
                  <RequestSummary
                    key={r.id}
                    feed={feed}
                    request={r}
                    selected={selected?.id === r.id}
                    onSelect={() => setPicked(r.id)}
                  />
                ))}
              </div>
            </details>
          )}
        </section>

        <section className="cr-pane cr-pane--detail" aria-labelledby="detail-h" aria-live="polite">
          {selected ? (
            <>
              <div className="cr-detail__head">
                <StatusBadge status={selected.status} />
                <span className="cr-time">Updated {ago(selected.updatedAt)}</span>
              </div>
              <h2 id="detail-h" className="cr-detail__title">
                {selected.title}
              </h2>
              <dl className="cr-detail__facts">
                <div>
                  <dt>Responsible</dt>
                  <dd className="cr-detail__owner">
                    {memberById(feed, selected.assigneeId)?.name ??
                      (selected.status === "offered" ? "Waiting for a reply" : "No one yet")}
                  </dd>
                </div>
                <div>
                  <dt>Requested by</dt>
                  <dd>
                    {memberById(feed, selected.requesterId)?.name}
                    {memberById(feed, selected.requesterId)?.location && (
                      <span className="cr-detail__loc">
                        <IconFlag size={16} /> {memberById(feed, selected.requesterId)?.location}
                      </span>
                    )}
                  </dd>
                </div>
                {selected.latestFact && (
                  <div className="cr-detail__fact">
                    <dt>
                      <IconPin size={16} /> Latest detail
                    </dt>
                    <dd>{selected.latestFact}</dd>
                  </div>
                )}
              </dl>
              <HandoffActions feed={feed} request={selected} />
              <h3 className="cr-pane__sub">History</h3>
              <RequestHistory feed={feed} request={selected} />
            </>
          ) : (
            <div className="cr-empty cr-empty--board">
              <h2 id="detail-h" className="cr-empty__title">
                Select a request
              </h2>
              <p className="cr-muted">Its details and history appear here.</p>
            </div>
          )}
        </section>

        <aside className="cr-pane cr-pane--side" aria-label="Crew activity and availability">
          <h2 className="cr-pane__title">Activity</h2>
          <ActivityList feed={feed} items={feed.activity.slice(0, 20)} showRequest />
          <h2 className="cr-pane__title cr-pane__title--gap">Crew</h2>
          <CrewList feed={feed} />
          <p className="cr-foot">
            Signed in as {feed.me.name}.{" "}
            <button className="cr-link" onClick={leave}>
              Leave on this device
            </button>
          </p>
        </aside>
      </main>

      <VoiceSheet feed={feed} />
    </div>
  );
}
