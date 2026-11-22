import { useEffect, useState } from "react";
import { AskForm } from "../components/AskForm";
import { HandoffActions } from "../components/CrewParts";
import type { Feed } from "../crew/contract";
import { useCrew, intentKey } from "../crew/CrewProvider";
import { requestById } from "../crew/derive";
import { Button, Sheet } from "../ui/primitives";
import { IconAlert, IconCheck, IconKeyboard, IconMic, IconX } from "../ui/icons";
import { VoiceRing } from "./TalkKey";
import { isVoiceActive, PHASE_LABEL, useVoice, type VoiceSubject } from "./VoiceProvider";
import { sameSubject, voiceSubjects } from "./subjects";

export function VoiceSheet({ feed }: { feed: Feed }) {
  const v = useVoice();
  const [typing, setTyping] = useState(false);
  const active = isVoiceActive(v.phase);
  const subjects = voiceSubjects(feed);
  // If the feed moved on (offer accepted elsewhere, request finished), follow
  // the same request where possible instead of pointing at a stale offer.
  const subject =
    subjects.find((s) => sameSubject(v.subject, s)) ??
    (active ? v.subject : null) ??
    subjects.find((s) => v.subject?.requestId && s.requestId === v.subject.requestId) ??
    subjects[0];
  const { setSubject } = v;
  useEffect(() => {
    if (!active && !sameSubject(v.subject, subject)) setSubject(subject);
  }, [active, v.subject, subject, setSubject]);
  const showTyping = typing || v.error !== null;
  const finish = () => {
    setTyping(false);
    v.close();
  };

  return (
    <Sheet
      open={v.isOpen}
      onClose={() => {
        setTyping(false);
        v.close();
      }}
      labelledBy="voice-title"
    >
      <header className="cr-sheet__head">
        <h2 id="voice-title" className="cr-sheet__title">
          Talk to Crew Radio
        </h2>
        <button
          className="cr-icon-btn"
          onClick={() => {
            setTyping(false);
            v.close();
          }}
          aria-label={active ? "End and close" : "Close"}
        >
          <IconX size={20} />
        </button>
      </header>

      {subjects.length > 1 && !active ? (
        <fieldset className="cr-subjects">
          <legend className="cr-field__label">What is this about?</legend>
          {subjects.map((s) => (
            <label key={`${s.requestId}-${s.offerId}`} className="cr-subject">
              <input
                type="radio"
                name="voice-subject"
                checked={sameSubject(subject, s)}
                onChange={() => v.setSubject(s)}
              />
              <span>{s.label}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="cr-subject-line">{subject.label}</p>
      )}

      <div className={`cr-onair cr-onair--${v.phase}`}>
        <button
          className="cr-onair__key"
          onClick={() => (active ? v.end() : v.start())}
          aria-label={active ? "End conversation" : "Start talking"}
        >
          <VoiceRing phase={v.phase} />
          <span className="cr-onair__face">{active ? <span className="cr-stop" /> : <IconMic size={34} />}</span>
        </button>
        <p className="cr-onair__state" role="status">
          {v.phase === "idle" ? "Tap to start talking" : PHASE_LABEL[v.phase]}
        </p>
        {active && (
          <Button tone="secondary" onClick={v.end}>
            End
          </Button>
        )}
      </div>

      {(v.agentLine || v.userLine) && (
        <div className="cr-transcript">
          {v.userLine && (
            <p>
              <span className="cr-transcript__who">You</span> {v.userLine}
            </p>
          )}
          {v.agentLine && (
            <p>
              <span className="cr-transcript__who">Crew Radio</span> {v.agentLine}
            </p>
          )}
        </div>
      )}

      {v.recorded && (
        <p className="cr-recorded">
          <IconCheck size={18} /> The crew server recorded your update. Screens show the confirmed state.
        </p>
      )}

      {v.error && (
        <p className="cr-inline-alert" role="alert">
          <IconAlert size={18} /> {v.error.message}
        </p>
      )}

      {showTyping ? (
        <div className="cr-manual">
          <h3 className="cr-manual__title">Type instead</h3>
          <ManualUpdate feed={feed} subject={subject} onDone={finish} />
        </div>
      ) : (
        <button className="cr-link cr-link--icon" onClick={() => setTyping(true)}>
          <IconKeyboard size={18} /> Type instead
        </button>
      )}
    </Sheet>
  );
}

function ManualUpdate({ feed, subject, onDone }: { feed: Feed; subject: VoiceSubject; onDone: () => void }) {
  const { act, pending } = useCrew();
  const [note, setNote] = useState("");
  const request = requestById(feed, subject.requestId);
  const offer = subject.offerId ? feed.myOffers.find((o) => o.id === subject.offerId) : undefined;

  if (offer && request) {
    if (offer.status !== "pending" || request.status !== "offered")
      return <p className="cr-muted">This offer is no longer open. The screen shows its latest state.</p>;
    return (
      <form className="cr-decline" onSubmit={(e) => e.preventDefault()}>
        <label className="cr-field">
          <span className="cr-field__label">Detail for the crew (optional)</span>
          <textarea className="cr-input cr-input--area" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="cr-actions">
          <Button
            tone="primary"
            busy={pending[intentKey({ kind: "accept", offerId: offer.id })]}
            busyLabel="Accepting…"
            onClick={async () => {
              if (await act({ kind: "accept", requestId: request.id, offerId: offer.id })) onDone();
            }}
          >
            Accept
          </Button>
          <Button
            busy={pending[intentKey({ kind: "decline", offerId: offer.id })]}
            busyLabel="Declining…"
            onClick={async () => {
              if (
                await act({ kind: "decline", requestId: request.id, offerId: offer.id, text: note.trim() || undefined })
              )
                onDone();
            }}
          >
            Decline
          </Button>
        </div>
      </form>
    );
  }
  if (request) return <HandoffActions feed={feed} request={request} onDone={onDone} />;
  return <AskForm id="voice-ask" onDone={onDone} />;
}
