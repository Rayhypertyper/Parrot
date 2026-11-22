// Client-side mirror of the shared contract in docs/crew-radio-plan.md §4.
// When Agent A publishes src/shared/crew, re-export those types from here
// so the rest of src/client keeps importing from "./contract".

export type Availability = "available" | "busy" | "protected";

export type RequestStatus =
  | "open"
  | "offered"
  | "in_progress"
  | "awaiting_confirmation"
  | "done";

export type OfferStatus = "pending" | "accepted" | "declined" | "withdrawn";

export type EventKind =
  | "request_help"
  | "availability_update"
  | "accept"
  | "decline"
  | "blocked"
  | "report_delivery"
  | "confirm_receipt";

export interface Member {
  id: string;
  name: string;
  location: string | null;
  availability: Availability;
  skills: string[];
}

export interface CrewRequest {
  id: string;
  title: string;
  requesterId: string;
  status: RequestStatus;
  revision: number;
  assigneeId: string | null;
  latestFact: string | null;
  updatedAt: string;
}

export interface Offer {
  id: string;
  requestId: string;
  recipientId: string;
  status: OfferStatus;
  message: string;
}

export interface ActivityItem {
  id: string;
  requestId: string | null;
  at: string;
  actorName: string;
  summary: string;
}

export interface Feed {
  me: Member;
  members: Member[];
  requests: CrewRequest[];
  myOffers: Offer[];
  activity: ActivityItem[];
  updatedAt: string;
  // Optional until A confirms the field; shown in the header when present.
  crewName?: string;
}

export interface JoinBody {
  crewCode: string;
  profileCode: string;
}

export interface JoinResult {
  memberToken: string;
  memberId: string;
  crewId: string;
}

export interface CrewEventBody {
  eventId: string;
  kind: EventKind;
  requestId?: string;
  offerId?: string;
  text?: string;
  location?: string;
  availability?: Availability;
}

export interface CrewEventResult {
  eventId: string;
  requestId?: string;
  result: string;
  message: string;
}

export interface VoiceSessionBody {
  requestId?: string;
  offerId?: string;
}

export interface VoiceSession {
  conversationToken: string;
  dynamicVariables: Record<string, string | number | boolean>;
}

// Route request to Agent A: the join screen needs the crew name and which
// profiles are unclaimed. Until it exists the UI falls back to a typed code.
export interface JoinProfile {
  profileCode: string;
  name: string;
  skills: string[];
  claimed: boolean;
}

export interface CrewDirectory {
  crewName: string;
  profiles: JoinProfile[];
}
