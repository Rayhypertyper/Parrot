export const crewRoutes = {
  join: '/crew/join',
  feed: '/crew/feed',
  events: '/crew/events',
  voiceSession: '/crew/voice-session',
  voiceTool: '/crew/voice-tool',
  retryPlan: '/crew/retry-plan',
} as const

export type Availability = 'available' | 'busy' | 'protected'
export type RequestStatus = 'open' | 'offered' | 'in_progress' | 'awaiting_confirmation' | 'done'
export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn'
export type PlanningStatus = 'idle' | 'planning' | 'waiting' | 'failed'

export function allHandsDetails(text: string): string | null {
  const trimmed = text.trim()
  const prefix = /^(?:please\s+)?all[\s-]+hands[\s-]+on[\s-]+deck\b[\s:,.!?–—-]*/i.exec(trimmed)
  if (prefix) return trimmed.slice(prefix[0].length).replace(/^and\s+/i, '')
  if (/^(?:(?:can|could|would|will|please)\s+)?everyone\b/i.test(trimmed)) return trimmed
  if (/^(?:(?:can|could|would) you |please )?(?:ask|tell|notify|ping|alert) everyone\b/i.test(trimmed)) return trimmed
  return null
}

export function allHandsSpeech(title: string, destination?: string | null) {
  const details = allHandsDetails(title) ?? title
  const location = destination && !details.toLowerCase().includes(destination.toLowerCase()) ? `Location: ${destination}.` : ''
  return ['All hands on deck.', details, location].filter(Boolean).join(' ')
}

export interface CrewMember {
  id: string
  name: string
  location: string
  availability: Availability
  skills: string[]
  archived?: true
}

export interface CrewRequest {
  id: string
  title: string
  allHands?: true
  requesterId: string
  status: RequestStatus
  revision: number
  assigneeId: string | null
  latestFact: string | null
  updatedAt: string
  pickupLocation?: string | null
  destination?: string | null
  planningStatus?: PlanningStatus
}

export interface CrewOffer {
  id: string
  requestId: string
  recipientId: string
  status: OfferStatus
  message: string
}

export interface CrewActivity {
  id: string
  requestId: string | null
  at: string
  actorName: string
  summary: string
}

export interface CrewFeed {
  me: CrewMember
  members: CrewMember[]
  requests: CrewRequest[]
  myOffers: CrewOffer[]
  activity: CrewActivity[]
  updatedAt: string
}

export interface CrewJoinInput {
  crewCode: string
  profileCode: string
}

export interface CrewSession {
  memberToken: string
  memberId: string
  crewId: string
}

export type CrewCommand =
  | { kind: 'request_help'; text: string; location?: string }
  | { kind: 'acknowledge_announcement'; requestId: string; text?: string }
  | { kind: 'availability_update'; availability?: 'available' | 'busy'; location?: string; text?: string }
  | { kind: 'accept'; requestId?: string; offerId: string }
  | { kind: 'decline'; requestId?: string; offerId: string; text?: string; location?: string }
  | { kind: 'blocked'; requestId: string; offerId?: string; text?: string; location?: string }
  | { kind: 'report_delivery'; requestId: string; offerId?: string; text?: string }
  | { kind: 'confirm_receipt'; requestId: string; offerId?: string; text?: string }

export type CrewEvent = CrewCommand & { eventId: string }

export interface CrewEventResult {
  eventId: string
  requestId?: string
  result: 'applied'
  message: string
}

export interface VoiceSessionInput {
  requestId?: string
  offerId?: string
  announcementId?: string
}

export interface VoiceSessionResult {
  conversationToken: string
  dynamicVariables: {
    secret__crew_ticket: string
    member_name: string
    opening_message: string
    request_context: string
    offer_context: string
  }
}

export interface RetryPlanInput {
  requestId: string
}

export interface RetryPlanResult {
  requestId: string
  result: 'offered' | 'waiting' | 'failed' | 'planning' | 'superseded'
  message: string
}

export interface CrewErrorResponse {
  code: 'invalid_input' | 'unauthorized' | 'not_found' | 'profile_taken' | 'conflict' | 'unavailable'
  message: string
}
