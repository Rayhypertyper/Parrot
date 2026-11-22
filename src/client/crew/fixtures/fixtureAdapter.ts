// In-browser stand-in for the Wasp routes, shared across tabs via
// localStorage so a "phone" tab and a "board" tab see the same crew.
// It follows the state rules in the brief closely enough to exercise every
// UI state, including 409s on stale offers and duplicate event IDs.
import { CrewApiError, type CrewApi } from "../api";
import type {
  ActivityItem,
  CrewEventBody,
  CrewEventResult,
  CrewRequest,
  Feed,
  Member,
  Offer,
} from "../contract";
import { FIXTURE_CREW, FIXTURE_MEMBERS } from "./seed";

const KEY = "crew-radio:fixture-db:v2";

interface Db {
  members: (Member & { profileCode: string })[];
  claimed: Record<string, string>; // profileCode -> token
  requests: CrewRequest[];
  offers: Offer[];
  activity: ActivityItem[];
  declined: Record<string, string[]>; // requestId -> memberIds
  events: Record<string, CrewEventResult>;
  seq: number;
}

function fresh(): Db {
  return {
    members: structuredClone(FIXTURE_MEMBERS),
    claimed: {},
    requests: [],
    offers: [],
    activity: [],
    declined: {},
    events: {},
    seq: 100,
  };
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    /* fall through */
  }
  return fresh();
}

function save(db: Db) {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* fixture only */
  }
}

export function resetFixture() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const id = (db: Db, p: string) => `${p}${++db.seq}`;

function memberFor(db: Db, token: string) {
  const m = db.members.find((x) => `fx-${x.id}` === token);
  if (!m || db.claimed[m.profileCode] !== token)
    throw new CrewApiError("Your session ended. Join the crew again.", 401);
  return m;
}

function log(db: Db, actorName: string, summary: string, requestId: string | null) {
  db.activity.unshift({ id: id(db, "a"), requestId, at: now(), actorName, summary });
  db.activity = db.activity.slice(0, 60);
}

function touch(r: CrewRequest) {
  r.revision += 1;
  r.updatedAt = now();
}

// A deliberately simple planner: skill keyword match, then availability.
function plan(db: Db, requestId: string) {
  const r = db.requests.find((x) => x.id === requestId);
  if (!r || r.status !== "open") return;
  const declined = db.declined[r.id] ?? [];
  const pool = db.members.filter(
    (m) =>
      m.id !== r.requesterId &&
      m.availability === "available" &&
      !declined.includes(m.id),
  );
  const wantsAv = /adapter|hdmi|cable|projector|mic|audio/i.test(r.title);
  const pick =
    pool.find((m) => wantsAv && m.skills.includes("AV")) ?? pool[0] ?? null;
  const requester = db.members.find((m) => m.id === r.requesterId)!;
  if (!pick) {
    r.planningStatus = "waiting";
    log(db, "Parrot", "No available teammate to ask yet", r.id);
    touch(r);
    return;
  }
  const to = r.destination ?? requester.location;
  const message = r.pickupLocation
    ? `Can you pick it up from ${r.pickupLocation} and bring it to ${to}? ${requester.name} needs: ${r.title}.`
    : `${requester.name} needs help: ${r.title}. Can you help?`;
  db.offers.push({
    id: id(db, "o"),
    requestId: r.id,
    recipientId: pick.id,
    status: "pending",
    message,
  });
  r.status = "offered";
  r.planningStatus = "idle";
  touch(r);
  log(db, "Parrot", `Asked ${pick.name} to help`, r.id);
}

function schedulePlan(requestId: string) {
  setTimeout(() => {
    const db = load();
    plan(db, requestId);
    save(db);
  }, 1400);
}

function stale(message = "That offer changed. Showing the latest.") {
  return new CrewApiError(message, 409, "stale");
}

function apply(db: Db, me: Member, body: CrewEventBody): CrewEventResult {
  const ok = (message: string, requestId?: string): CrewEventResult => ({
    eventId: body.eventId,
    requestId,
    result: "applied",
    message,
  });
  const req = body.requestId
    ? db.requests.find((r) => r.id === body.requestId)
    : undefined;
  const offer = body.offerId
    ? db.offers.find((o) => o.id === body.offerId)
    : undefined;

  switch (body.kind) {
    case "request_help": {
      const text = body.text?.trim();
      if (!text) throw new CrewApiError("Say what you need and where.", 400);
      const r: CrewRequest = {
        id: id(db, "r"),
        title: text.replace(/[.!?]+$/, ""),
        requesterId: me.id,
        status: "open",
        revision: 1,
        assigneeId: null,
        latestFact: null,
        pickupLocation: null,
        destination: body.location?.trim() || me.location,
        planningStatus: "planning",
        updatedAt: now(),
      };
      db.requests.unshift(r);
      log(db, me.name, `Asked for help: ${r.title}`, r.id);
      schedulePlan(r.id);
      return ok("Request recorded. Looking for someone to help.", r.id);
    }
    case "availability_update": {
      if (me.availability === "protected")
        throw new CrewApiError("Protected posts are set by the organizer.", 403);
      if (body.availability !== "available" && body.availability !== "busy")
        throw new CrewApiError("Choose available or busy.", 400);
      const m = db.members.find((x) => x.id === me.id)!;
      m.availability = body.availability;
      log(db, me.name, `Set availability to ${body.availability}`, null);
      return ok(`You're marked ${body.availability}.`);
    }
    case "accept":
    case "decline": {
      if (!offer || !req || offer.recipientId !== me.id) throw stale();
      if (offer.status !== "pending" || req.status !== "offered") throw stale();
      if (body.kind === "accept") {
        if (me.availability !== "available")
          throw new CrewApiError("Set yourself available before accepting.", 409);
        offer.status = "accepted";
        req.status = "in_progress";
        req.assigneeId = me.id;
        touch(req);
        log(db, me.name, "Accepted the handoff", req.id);
        return ok("You're on it.", req.id);
      }
      offer.status = "declined";
      db.declined[req.id] = [...(db.declined[req.id] ?? []), me.id];
      req.status = "open";
      if (body.text?.trim()) req.latestFact = body.text.trim();
      if (body.location?.trim()) req.pickupLocation = body.location.trim();
      req.planningStatus = "planning";
      touch(req);
      log(
        db,
        me.name,
        body.text?.trim() ? `Declined: "${body.text.trim()}"` : "Declined",
        req.id,
      );
      schedulePlan(req.id);
      return ok("Declined. Parrot will ask someone else.", req.id);
    }
    case "blocked": {
      if (!req || req.assigneeId !== me.id || req.status !== "in_progress")
        throw stale("This handoff changed. Showing the latest.");
      req.status = "open";
      req.assigneeId = null;
      if (body.text?.trim()) req.latestFact = body.text.trim();
      if (body.location?.trim()) req.pickupLocation = body.location.trim();
      req.planningStatus = "planning";
      db.declined[req.id] = [...(db.declined[req.id] ?? []), me.id];
      touch(req);
      log(db, me.name, body.text?.trim() ? `Blocked: "${body.text.trim()}"` : "Blocked", req.id);
      schedulePlan(req.id);
      return ok("Released. Parrot will look for someone else.", req.id);
    }
    case "report_delivery": {
      if (!req || req.assigneeId !== me.id || req.status !== "in_progress")
        throw stale("This handoff changed. Showing the latest.");
      req.status = "awaiting_confirmation";
      touch(req);
      log(db, me.name, "Reported delivered", req.id);
      return ok("Delivery reported. Waiting for confirmation.", req.id);
    }
    case "confirm_receipt": {
      if (!req || req.requesterId !== me.id) throw stale();
      if (req.status !== "in_progress" && req.status !== "awaiting_confirmation")
        throw stale("This request changed. Showing the latest.");
      req.status = "done";
      touch(req);
      log(db, me.name, "Confirmed received", req.id);
      return ok("Confirmed. Request is done.", req.id);
    }
  }
}

export const fixtureAdapter: CrewApi = {
  kind: "fixture",

  async directory(crewCode) {
    await wait(150);
    if (crewCode.toLowerCase() !== FIXTURE_CREW.code)
      throw new CrewApiError(`No crew found for code "${crewCode}".`, 404);
    const db = load();
    return {
      crewName: FIXTURE_CREW.name,
      profiles: db.members.map((m) => ({
        profileCode: m.profileCode,
        name: m.name,
        skills: m.skills,
        claimed: Boolean(db.claimed[m.profileCode]),
      })),
    };
  },

  async join({ crewCode, profileCode }) {
    await wait(250);
    if (crewCode.toLowerCase() !== FIXTURE_CREW.code)
      throw new CrewApiError(`No crew found for code "${crewCode}".`, 404);
    const db = load();
    const m = db.members.find((x) => x.profileCode === profileCode);
    if (!m) throw new CrewApiError("That profile isn't on this crew.", 404);
    if (db.claimed[profileCode])
      throw new CrewApiError(
        `${m.name} is already joined on another device. Choose another profile.`,
        409,
        "profile_taken",
      );
    const token = `fx-${m.id}`;
    db.claimed[profileCode] = token;
    log(db, m.name, "Joined the crew", null);
    save(db);
    return { memberToken: token, memberId: m.id, crewId: FIXTURE_CREW.id };
  },

  async feed(token) {
    await wait(80);
    const db = load();
    const me = memberFor(db, token);
    const order: Record<string, number> = {
      offered: 0,
      in_progress: 1,
      awaiting_confirmation: 2,
      open: 3,
      done: 4,
    };
    const feed: Feed = {
      crewName: FIXTURE_CREW.name,
      me: strip(me),
      members: db.members.map(strip),
      requests: [...db.requests].sort(
        (a, b) =>
          order[a.status] - order[b.status] ||
          b.updatedAt.localeCompare(a.updatedAt),
      ),
      myOffers: db.offers.filter((o) => o.recipientId === me.id),
      activity: db.activity.slice(0, 30),
      updatedAt: now(),
    };
    return feed;
  },

  async sendEvent(token, body) {
    await wait(300);
    const db = load();
    const me = memberFor(db, token);
    const prior = db.events[body.eventId];
    if (prior) return prior;
    const result = apply(db, me, body);
    db.events[body.eventId] = result;
    save(db);
    return result;
  },

  async retryPlan(token, requestId) {
    await wait(200);
    const db = load();
    memberFor(db, token);
    const r = db.requests.find((x) => x.id === requestId);
    if (!r || r.status !== "open")
      throw stale("This request isn't open any more.");
    if (r.planningStatus === "planning")
      return { requestId, result: "planning", message: "Already looking for help." };
    r.planningStatus = "planning";
    save(db);
    schedulePlan(r.id);
    return { requestId, result: "planning", message: "Looking for help." };
  },

  async voiceSession(token) {
    await wait(400);
    memberFor(load(), token);
    throw new CrewApiError(
      "Voice needs the live Parrot server. Type your update instead.",
      503,
      "voice_unavailable",
    );
  },
};

function strip(m: Member & { profileCode?: string }): Member {
  const { profileCode: _p, ...rest } = m;
  return rest;
}
