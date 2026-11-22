import type { CrewRequest, Feed, Member, Offer, RequestStatus } from "./contract";

export function memberById(feed: Feed, id: string | null | undefined): Member | undefined {
  if (!id) return undefined;
  return feed.members.find((m) => m.id === id) ?? (feed.me.id === id ? feed.me : undefined);
}

export function requestById(feed: Feed, id: string | null | undefined) {
  return id ? feed.requests.find((r) => r.id === id) : undefined;
}

/** Pending offers addressed to me whose request is still waiting on that offer. */
export function pendingOffers(feed: Feed): { offer: Offer; request: CrewRequest }[] {
  return feed.myOffers
    .filter((o) => o.status === "pending")
    .map((offer) => ({ offer, request: requestById(feed, offer.requestId) }))
    .filter(
      (x): x is { offer: Offer; request: CrewRequest } =>
        Boolean(x.request) && x.request!.status === "offered",
    );
}

export const isActive = (r: CrewRequest) => !r.allHands && r.status !== "done";

export function myAssignments(feed: Feed) {
  return feed.requests.filter(
    (r) =>
      !r.allHands && r.assigneeId === feed.me.id &&
      (r.status === "in_progress" || r.status === "awaiting_confirmation"),
  );
}

export function myOpenRequests(feed: Feed) {
  return feed.requests.filter((r) => r.requesterId === feed.me.id && isActive(r));
}

export function activityFor(feed: Feed, requestId: string) {
  return feed.activity.filter((a) => a.requestId === requestId);
}

/** What this member can do on a request right now, by role and state. */
export type NextStep =
  | { kind: "report_delivery" }
  | { kind: "confirm_receipt" }
  | { kind: "retry_plan" }
  | { kind: "wait"; text: string }
  | { kind: "none" };

export function nextStepFor(feed: Feed, r: CrewRequest): NextStep {
  const me = feed.me.id;
  const assignee = memberById(feed, r.assigneeId)?.name ?? "the helper";
  const requester = memberById(feed, r.requesterId)?.name ?? "the requester";
  if (r.requesterId === me) {
    if (r.status === "in_progress" || r.status === "awaiting_confirmation")
      return { kind: "confirm_receipt" };
    if (r.status === "open" && r.planningStatus !== "planning") return { kind: "retry_plan" };
    if (r.status === "offered") return { kind: "wait", text: "Waiting for a reply to the offer" };
    return { kind: "none" };
  }
  if (r.assigneeId === me) {
    if (r.status === "in_progress") return { kind: "report_delivery" };
    if (r.status === "awaiting_confirmation")
      return { kind: "wait", text: `Waiting for ${requester} to confirm` };
  }
  if (r.status === "in_progress") return { kind: "wait", text: `${assignee} is on it` };
  return { kind: "none" };
}

export const STATUS_LABEL: Record<RequestStatus, string> = {
  open: "Open",
  offered: "Offer sent",
  in_progress: "In progress",
  awaiting_confirmation: "Awaiting confirmation",
  done: "Done",
};

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function clock(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : timeFmt.format(d);
}

export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return clock(iso);
}
