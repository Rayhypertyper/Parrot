import type { Feed } from "../crew/contract";
import { memberById, myAssignments, myOpenRequests, pendingOffers } from "../crew/derive";
import type { VoiceSubject } from "./VoiceProvider";

export const newVoiceSubject: VoiceSubject = { label: "Something new: ask for help or share an update" };

/** Plausible things a conversation could be about, most urgent first. */
export function voiceSubjects(feed: Feed): VoiceSubject[] {
  const list: VoiceSubject[] = [];
  for (const { offer, request } of pendingOffers(feed)) {
    const who = memberById(feed, request.requesterId)?.name ?? "a teammate";
    list.push({ label: `Offer from ${who}: ${request.title}`, requestId: request.id, offerId: offer.id });
  }
  for (const r of myAssignments(feed)) list.push({ label: `Your handoff: ${r.title}`, requestId: r.id });
  for (const r of myOpenRequests(feed)) list.push({ label: `Your request: ${r.title}`, requestId: r.id });
  list.push(newVoiceSubject);
  return list;
}

export const sameSubject = (a: VoiceSubject | null, b: VoiceSubject) =>
  !!a && a.requestId === b.requestId && a.offerId === b.offerId && a.announcementId === b.announcementId;
