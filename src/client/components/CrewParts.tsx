import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ActivityItem, CrewRequest, Feed, Member, Offer } from "../crew/contract";
import { useCrew, intentKey } from "../crew/CrewProvider";
import {
  activityFor,
  ago,
  clock,
  memberById,
  nextStepFor,
} from "../crew/derive";
import { AvailabilityMark, Button, StatusBadge } from "../ui/primitives";
import {
  IconAlert,
  IconCheck,
  IconFlag,
  IconMic,
  IconOffline,
  IconPin,
  IconRetry,
  IconX,
} from "../ui/icons";
import { useVoice } from "../voice/VoiceProvider";
import { AllHandsAlerts } from "./AllHandsAlerts";

/* ---------- connection + notices ---------- */

export function LinkStatus({ detailed }: { detailed?: boolean }) {
  const { link, feed } = useCrew();
  if (link === "offline")
    return (
      <span className="cr-link-status is-offline" role="status">
        <IconOffline size={16} /> Reconnecting
      </span>
    );
  const synced = feed ? `Synced ${clock(feed.updatedAt)}` : "";
  return (
    <span className="cr-link-status" role="status" title={synced}>
      <span className="cr-link-status__dot" aria-hidden="true" />
      {!feed ? "Connecting" : detailed ? `Live. ${synced}` : "Live"}
    </span>
  );
}

export function NoticeBar({ handsFreeAnnouncements = false }: { handsFreeAnnouncements?: boolean }) {
  const { feed, notice, say } = useCrew();
  return (
    <div className="cr-notice-slot" aria-live="polite">
      {feed && <AllHandsAlerts key={feed.me.id} feed={feed} handsFree={handsFreeAnnouncements} />}
      {notice && (
        <div className={`cr-notice cr-notice--${notice.tone}`} key={notice.at}>
          {notice.tone !== "ok" ? <IconAlert size={18} /> : <IconCheck size={18} />}
          <span>{notice.text}</span>
          <button className="cr-icon-btn" onClick={() => say(null)} aria-label="Dismiss message">
            <IconX size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- availability ---------- */

export function AvailabilityControl({ me }: { me: Member }) {
  const { act, pending } = useCrew();
  if (me.availability === "protected") return <AvailabilityMark value="protected" />;
  const busy = pending[intentKey({ kind: "availability_update" })];
  return (
    <div className="cr-seg" role="group" aria-label="Your availability">
      {(["available", "busy"] as const).map((v) => (
        <button
          key={v}
          className="cr-seg__opt"
          aria-pressed={me.availability === v}
          disabled={busy}
          onClick={() =>
            me.availability !== v && act({ kind: "availability_update", availability: v })
          }
        >
          {v === "available" ? "Available" : "Busy"}
        </button>
      ))}
    </div>
  );
}

/* ---------- the offer: strongest element on the phone ---------- */

export function OfferCard({
  feed,
  offer,
  request,
}: {
  feed: Feed;
  offer: Offer;
  request: CrewRequest;
}) {
  const { act, pending } = useCrew();
  const voice = useVoice();
  const [declining, setDeclining] = useState(false);
  const [note, setNote] = useState("");
  const [pickup, setPickup] = useState("");
  const requester = memberById(feed, request.requesterId);
  const acceptKey = intentKey({ kind: "accept", offerId: offer.id });
  const declineKey = intentKey({ kind: "decline", offerId: offer.id });
  const headingId = `offer-${offer.id}`;

  return (
    <section className="cr-offer" aria-labelledby={headingId}>
      <p className="cr-offer__from" id={headingId}>
        {requester?.name ?? "A teammate"} is asking you
      </p>
      <ClampedText className="cr-offer__message" text={offer.message} />

      <Places feed={feed} request={request} />

      {!declining ? (
        <div className="cr-offer__actions">
          <Button
            tone="primary"
            busy={pending[acceptKey]}
            busyLabel="Accepting…"
            icon={<IconCheck size={20} />}
            onClick={() => act({ kind: "accept", requestId: request.id, offerId: offer.id })}
          >
            Accept
          </Button>
          <Button tone="secondary" onClick={() => setDeclining(true)} disabled={pending[acceptKey]}>
            Decline
          </Button>
        </div>
      ) : (
        <form
          className="cr-decline"
          onSubmit={async (e) => {
            e.preventDefault();
            const r = await act({
              kind: "decline",
              requestId: request.id,
              offerId: offer.id,
              text: note.trim() || undefined,
              location: pickup.trim() || undefined,
            });
            if (r) setDeclining(false);
          }}
        >
          <label className="cr-field">
            <span className="cr-field__label">Anything the next person should know?</span>
            <textarea
              className="cr-input cr-input--area"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why you can't go, or where it is"
              autoFocus
            />
          </label>
          <PickupField value={pickup} onChange={setPickup} />
          <div className="cr-offer__actions">
            <Button tone="primary" type="submit" busy={pending[declineKey]} busyLabel="Declining…">
              Decline
            </Button>
            <Button type="button" tone="quiet" onClick={() => setDeclining(false)}>
              Back
            </Button>
          </div>
        </form>
      )}

      <button
        className="cr-offer__talk"
        onClick={() =>
          voice.open({
            label: `Reply to ${requester?.name ?? "the"} offer`,
            requestId: request.id,
            offerId: offer.id,
          })
        }
      >
        <IconMic size={18} /> Answer by voice
      </button>
    </section>
  );
}

/** Where to collect and where to bring, plus the newest words from the crew. */
export function Places({
  feed,
  request,
  compact,
}: {
  feed: Feed;
  request: CrewRequest;
  compact?: boolean;
}) {
  const requester = memberById(feed, request.requesterId);
  const destination = request.destination ?? requester?.location ?? null;
  const fact = request.latestFact;
  const factIsPickup = fact && request.pickupLocation && fact.trim() === request.pickupLocation.trim();
  const icon = compact ? 16 : 18;
  return (
    <dl className={`cr-facts${compact ? " cr-facts--places" : ""}`}>
      {request.pickupLocation && (
        <div className="cr-fact cr-fact--new">
          <dt>
            <IconPin size={icon} /> Pick up at
          </dt>
          <dd className="cr-fact__place">{request.pickupLocation}</dd>
          {fact && !factIsPickup && <dd className="cr-fact__said">“{fact}”</dd>}
        </div>
      )}
      {!request.pickupLocation && fact && (
        <div className="cr-fact cr-fact--new">
          <dt>
            <IconPin size={icon} /> Latest detail
          </dt>
          <dd>{fact}</dd>
        </div>
      )}
      {destination && (
        <div className="cr-fact">
          <dt>
            <IconFlag size={icon} /> Bring to
          </dt>
          <dd className="cr-fact__place">{destination}</dd>
        </div>
      )}
    </dl>
  );
}

function PickupField({
  value,
  onChange,
  label = "Where can they pick it up? (optional)",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <label className="cr-field">
      <span className="cr-field__label">{label}</span>
      <input
        className="cr-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Exact spot, in your words"
        autoComplete="off"
      />
    </label>
  );
}

/** Shows the planner's real state for an open request; nothing is invented. */
export function PlanningNote({ request }: { request: CrewRequest }) {
  if (request.status !== "open") return null;
  const s = request.planningStatus;
  if (s === "planning")
    return (
      <span className="cr-planning">
        <span className="cr-planning__dot" aria-hidden="true" /> Looking for help
      </span>
    );
  if (s === "waiting")
    return (
      <span className="cr-planning cr-planning--warn">
        <IconAlert size={16} /> No one available to ask yet
      </span>
    );
  if (s === "failed")
    return (
      <span className="cr-planning cr-planning--warn">
        <IconAlert size={16} /> Couldn't plan a handoff. Ask the crew again.
      </span>
    );
  return null;
}

/** Long instructions stay a few lines tall so Accept stays in reach; full text on tap. */
function ClampedText({ text, className }: { text: string; className: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [text, open]);
  return (
    <div>
      <p ref={ref} className={`${className}${open ? "" : " is-clamped"}`}>
        {text}
      </p>
      {(overflows || open) && (
        <button className="cr-link" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Show less" : "Show full message"}
        </button>
      )}
    </div>
  );
}

/* ---------- active handoff: role-appropriate next step ---------- */

export function HandoffActions({
  feed,
  request,
  onDone,
}: {
  feed: Feed;
  request: CrewRequest;
  onDone?: () => void;
}) {
  const { act, retryPlan, pending } = useCrew();
  const [blocking, setBlocking] = useState(false);
  const [note, setNote] = useState("");
  const [pickup, setPickup] = useState("");
  const step = nextStepFor(feed, request);
  const k = (kind: Parameters<typeof intentKey>[0]["kind"]) =>
    pending[intentKey({ kind, requestId: request.id })];

  if (step.kind === "report_delivery")
    return blocking ? (
      <form
        className="cr-decline"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await act({
            kind: "blocked",
            requestId: request.id,
            text: note.trim() || undefined,
            location: pickup.trim() || undefined,
          });
          if (r) {
            setBlocking(false);
            onDone?.();
          }
        }}
      >
        <label className="cr-field">
          <span className="cr-field__label">What's stopping you?</span>
          <textarea
            className="cr-input cr-input--area"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            autoFocus
          />
        </label>
        <PickupField value={pickup} onChange={setPickup} label="Where is it now? (optional)" />
        <div className="cr-actions">
          <Button tone="danger" type="submit" busy={k("blocked")} busyLabel="Releasing…">
            Release this handoff
          </Button>
          <Button type="button" tone="quiet" onClick={() => setBlocking(false)}>
            Back
          </Button>
        </div>
      </form>
    ) : (
      <div className="cr-actions">
        <Button
          tone="primary"
          icon={<IconCheck size={20} />}
          busy={k("report_delivery")}
          busyLabel="Reporting…"
          onClick={async () => (await act({ kind: "report_delivery", requestId: request.id })) && onDone?.()}
        >
          Report delivered
        </Button>
        <Button tone="quiet" onClick={() => setBlocking(true)}>
          I'm blocked
        </Button>
      </div>
    );

  if (step.kind === "confirm_receipt")
    return (
      <div className="cr-actions">
        <Button
          tone="primary"
          icon={<IconCheck size={20} />}
          busy={k("confirm_receipt")}
          busyLabel="Confirming…"
          onClick={async () => (await act({ kind: "confirm_receipt", requestId: request.id })) && onDone?.()}
        >
          Confirm received
        </Button>
      </div>
    );

  if (step.kind === "retry_plan")
    return (
      <div className="cr-actions">
        <Button
          tone="secondary"
          icon={<IconRetry size={18} />}
          busy={pending[`retry:${request.id}`]}
          busyLabel="Looking for help…"
          onClick={() => retryPlan(request.id)}
        >
          Ask the crew again
        </Button>
      </div>
    );

  if (step.kind === "wait") return <p className="cr-wait">{step.text}</p>;
  return null;
}

export function HandoffCard({ feed, request }: { feed: Feed; request: CrewRequest }) {
  const requester = memberById(feed, request.requesterId);
  const assignee = memberById(feed, request.assigneeId);
  const mine = request.assigneeId === feed.me.id;
  return (
    <article className="cr-handoff">
      <div className="cr-handoff__head">
        <StatusBadge status={request.status} />
        <span className="cr-time">{ago(request.updatedAt)}</span>
      </div>
      <h3 className="cr-handoff__title">{request.title}</h3>
      <Places feed={feed} request={request} compact />
      <dl className="cr-facts cr-facts--compact">
        <div className="cr-fact">
          <dt>Requested by</dt>
          <dd>{requester?.id === feed.me.id ? "You" : requester?.name}</dd>
        </div>
        <div className="cr-fact">
          <dt>Responsible</dt>
          <dd>{mine ? "You" : assignee?.name ?? "No one yet"}</dd>
        </div>
      </dl>
      <PlanningNote request={request} />
      <HandoffActions feed={feed} request={request} />
    </article>
  );
}

/* ---------- lists ---------- */

export function RequestSummary({
  feed,
  request,
  selected,
  onSelect,
}: {
  feed: Feed;
  request: CrewRequest;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const requester = memberById(feed, request.requesterId);
  const assignee = memberById(feed, request.assigneeId);
  const owner =
    request.status === "in_progress" || request.status === "awaiting_confirmation"
      ? assignee?.name
      : null;
  const body = (
    <>
      <span className="cr-req__top">
        <StatusBadge status={request.status} />
        <span className="cr-time">{clock(request.updatedAt)}</span>
      </span>
      <span className="cr-req__title">{request.title}</span>
      <span className="cr-req__meta">
        {requester?.id === feed.me.id ? "You asked" : `${requester?.name ?? "Someone"} asked`}
        {owner ? `. ${owner === feed.me.name ? "You're" : `${owner} is`} responsible` : ""}
      </span>
      <PlanningNote request={request} />
    </>
  );
  if (onSelect)
    return (
      <button className={`cr-req${selected ? " is-selected" : ""}`} aria-pressed={selected} onClick={onSelect}>
        {body}
      </button>
    );
  return <div className="cr-req">{body}</div>;
}

export function ActivityList({
  items,
  feed,
  empty = "No activity yet.",
  showRequest,
}: {
  items: ActivityItem[];
  feed: Feed;
  empty?: ReactNode;
  showRequest?: boolean;
}) {
  if (!items.length) return <p className="cr-muted cr-pad">{empty}</p>;
  return (
    <ol className="cr-activity">
      {items.map((a) => {
        const found = showRequest && a.requestId ? feed.requests.find((r) => r.id === a.requestId) : null;
        const req = found && !a.summary.includes(found.title) ? found : null;
        return (
          <li key={a.id} className="cr-activity__row">
            <time className="cr-activity__time" dateTime={a.at}>
              {clock(a.at)}
            </time>
            <span className="cr-activity__text">
              <strong>{displayActor(a.actorName)}</strong> {lowerFirst(a.summary)}
              {req && <span className="cr-activity__req">{req.title}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// The server still writes its planner's activity as "Crew Radio"; show the
// product name until the server copy is renamed.
function displayActor(name: string) {
  return name === "Crew Radio" ? "Parrot" : name;
}

function lowerFirst(s: string) {
  return /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

export function CrewList({ feed }: { feed: Feed }) {
  return (
    <ul className="cr-crew">
      {feed.members.filter((member) => !member.archived).map((m) => (
        <li key={m.id} className="cr-crew__row">
          <div className="cr-crew__head">
            <span className="cr-crew__name">
              {m.name}
              {m.id === feed.me.id && <span className="cr-you"> (you)</span>}
            </span>
            <AvailabilityMark value={m.availability} />
          </div>
          <span className="cr-crew__loc">{m.location.trim() || "Location not shared"}</span>
          {m.skills.length > 0 && <span className="cr-crew__skills">{m.skills.join(", ")}</span>}
        </li>
      ))}
    </ul>
  );
}

export function RequestHistory({ feed, request }: { feed: Feed; request: CrewRequest }) {
  return (
    <ActivityList
      feed={feed}
      items={activityFor(feed, request.id)}
      empty="Nothing recorded on this request yet."
    />
  );
}
