// The client's view of Agent A's contract in src/shared/crew. Types come from
// there; the aliases keep component code short. Only the join directory below
// is client-side, pending A's route.
import type {
  CrewActivity,
  CrewCommand,
  CrewFeed,
  CrewJoinInput,
  CrewMember,
  CrewOffer,
  CrewSession,
  VoiceSessionInput,
  VoiceSessionResult,
} from "../../shared/crew/index";

export type {
  Availability,
  CrewErrorResponse,
  CrewEventResult,
  CrewRequest,
  OfferStatus,
  PlanningStatus,
  RequestStatus,
  RetryPlanResult,
} from "../../shared/crew/index";
export { crewRoutes } from "../../shared/crew/index";

export type Member = CrewMember;
export type Offer = CrewOffer;
export type ActivityItem = CrewActivity;
export type JoinBody = CrewJoinInput;
export type JoinResult = CrewSession;
export type VoiceSessionBody = VoiceSessionInput;
export type VoiceSession = VoiceSessionResult;
export type EventKind = CrewCommand["kind"];

/** Feed plus an optional crew name, shown in the header when A adds it. */
export type Feed = CrewFeed & { crewName?: string };

/**
 * One loose shape for every tap action. The server validates the kind-specific
 * fields (see CrewCommand); the UI only sends what each control collects.
 */
export interface CrewEventBody {
  eventId: string;
  kind: EventKind;
  requestId?: string;
  offerId?: string;
  text?: string;
  location?: string;
  availability?: "available" | "busy";
}

// Route request to Agent A: GET /crew/profiles?crewCode=… so the join screen
// can list unclaimed profiles. Until it exists the UI falls back to a typed code.
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
