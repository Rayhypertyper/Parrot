import { useRef, useState } from "react";
import { CrewShell, usePageTitle } from "./CrewShell";
import type { Feed } from "./crew/contract";
import { useCrew } from "./crew/CrewProvider";
import { isActive, myAssignments, myOpenRequests, pendingOffers } from "./crew/derive";
import { AskForm } from "./components/AskForm";
import {
  ActivityList,
  AvailabilityControl,
  HandoffCard,
  LinkStatus,
  NoticeBar,
  OfferCard,
  RequestSummary,
} from "./components/CrewParts";
import { IconBoard, IconHand } from "./ui/icons";
import { Wordmark } from "./ui/Wordmark";
import { HandsFreeOffers } from "./voice/HandsFreeOffers";
import { TalkKey } from "./voice/TalkKey";
import { useVoice } from "./voice/VoiceProvider";
import { VoiceSheet } from "./voice/VoiceSheet";
import { voiceSubjects } from "./voice/subjects";

export function PhonePage() {
  usePageTitle("Parrot");
  return <CrewShell>{(feed) => <PhoneHome feed={feed} />}</CrewShell>;
}

export default PhonePage;

function PhoneHome({ feed }: { feed: Feed }) {
  const voice = useVoice();
  const [handsFree, setHandsFree] = useState(false);
  const announcementMicFailed = voice.subject?.announcementId && voice.phase === "error";
  const { leave, session } = useCrew();
  const crewLabel = feed.crewName ?? `Crew ${session?.crewCode ?? ""}`.trim();
  const askRef = useRef<HTMLTextAreaElement>(null);
  const offers = pendingOffers(feed);
  const mine = [...myAssignments(feed), ...myOpenRequests(feed)];
  const mineIds = new Set([...mine.map((r) => r.id), ...offers.map((o) => o.request.id)]);
  const others = feed.requests.filter((r) => isActive(r) && !mineIds.has(r.id));
  const nothing = !offers.length && !mine.length && !others.length;

  return (
    <div className="cr-phone">
      <header className="cr-top">
        <div className="cr-top__crew">
          <h1 className="cr-top__brand">
            <Wordmark />
            <span className="cr-visually-hidden">, </span>
            <span className="cr-top__name">{crewLabel}</span>
          </h1>
        </div>
        <div className="cr-top__right">
          <LinkStatus />
          <a className="cr-icon-btn" href="/board" aria-label="Open the crew board">
            <IconBoard size={20} />
          </a>
        </div>
      </header>

      <section className="cr-me" aria-label="You">
        <div>
          <p className="cr-me__name">{feed.me.name}</p>
          {feed.me.location && <p className="cr-me__loc">{feed.me.location}</p>}
        </div>
        <AvailabilityControl me={feed.me} />
      </section>

      <NoticeBar handsFreeAnnouncements={handsFree && !announcementMicFailed} />
      <HandsFreeOffers feed={feed} enabled={handsFree} setEnabled={setHandsFree} />

      <main className="cr-phone__main">
        {offers.map(({ offer, request }) => (
          <OfferCard key={offer.id} feed={feed} offer={offer} request={request} />
        ))}

        {mine.length > 0 && (
          <section className="cr-section" aria-labelledby="mine-h">
            <h2 id="mine-h" className="cr-section__title">
              Your handoffs
            </h2>
            {mine.map((r) => (
              <HandoffCard key={r.id} feed={feed} request={r} />
            ))}
          </section>
        )}

        {nothing && (
          <section className="cr-empty">
            <IconHand size={28} />
            <h2 className="cr-empty__title">Nothing needs a hand right now</h2>
            <p className="cr-muted">
              Need something moved, found or covered? Type it below or tap Talk.
            </p>
            <button className="cr-btn cr-btn--secondary" onClick={() => askRef.current?.focus()}>
              <span>Ask for help</span>
            </button>
          </section>
        )}

        {others.length > 0 && (
          <section className="cr-section" aria-labelledby="crew-h">
            <h2 id="crew-h" className="cr-section__title">
              Crew requests
            </h2>
            <div className="cr-req-list">
              {others.map((r) => (
                <RequestSummary key={r.id} feed={feed} request={r} />
              ))}
            </div>
          </section>
        )}

        <section className="cr-section" aria-labelledby="act-h">
          <h2 id="act-h" className="cr-section__title">
            Recent activity
          </h2>
          <ActivityList feed={feed} items={feed.activity.slice(0, 12)} showRequest />
        </section>

        <p className="cr-foot">
          Joined as {feed.me.name}.{" "}
          <button className="cr-link" onClick={leave}>
            Leave on this device
          </button>
        </p>
      </main>

      <div className="cr-dock">
        <div className="cr-dock__inner">
          <AskForm compact ref={askRef} id="dock-ask" />
          <TalkKey onPress={() => voice.open(voiceSubjects(feed)[0])} />
        </div>
      </div>

      <VoiceSheet feed={feed} />
    </div>
  );
}
