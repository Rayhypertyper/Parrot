import type {
  CrewDirectory,
  CrewEventBody,
  CrewEventResult,
  Feed,
  JoinBody,
  JoinResult,
  VoiceSession,
  VoiceSessionBody,
} from "./contract";

/** The narrow surface the UI uses. Fixture and HTTP adapters both implement it. */
export interface CrewApi {
  readonly kind: "http" | "fixture";
  directory(crewCode: string): Promise<CrewDirectory | null>;
  join(body: JoinBody): Promise<JoinResult>;
  feed(token: string): Promise<Feed>;
  sendEvent(token: string, body: CrewEventBody): Promise<CrewEventResult>;
  retryPlan(token: string, requestId: string): Promise<CrewEventResult>;
  voiceSession(token: string, body: VoiceSessionBody): Promise<VoiceSession>;
}

export class CrewApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "CrewApiError";
  }
  get isStale() {
    return this.status === 409;
  }
  get isUnauthorized() {
    return this.status === 401;
  }
  get isNetwork() {
    return this.status === 0;
  }
}

export function messageOf(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Try again.";
}
