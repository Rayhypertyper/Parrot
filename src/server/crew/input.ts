import type { CrewCommand } from '../../shared/crew/index'

export class CrewError extends Error {
  constructor(
    readonly status: number,
    readonly code: 'invalid_input' | 'unauthorized' | 'not_found' | 'profile_taken' | 'conflict' | 'unavailable',
    message: string,
  ) {
    super(message)
  }
}

export function invalid(message: string): never {
  throw new CrewError(400, 'invalid_input', message)
}

export function conflict(message: string): never {
  throw new CrewError(409, 'conflict', message)
}

export function notFound(message: string): never {
  throw new CrewError(404, 'not_found', message)
}

export function bodyObject(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Send a JSON object.')
  return body as Record<string, unknown>
}

export function field(body: Record<string, unknown>, name: string, maxLength = 128): string | undefined {
  const value = body[name]
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength || value.includes('\0')) {
    invalid(`Provide a valid ${name}.`)
  }
  return value.trim()
}

export function required(body: Record<string, unknown>, name: string, maxLength?: number): string {
  return field(body, name, maxLength) ?? invalid(`Provide ${name}.`)
}

export function parseCommand(body: Record<string, unknown>): CrewCommand {
  const text = field(body, 'text', 1000)
  const location = field(body, 'location', 500)
  const requestId = field(body, 'requestId')
  const offerId = field(body, 'offerId')
  switch (body.kind) {
    case 'request_help':
      return { kind: body.kind, text: text ?? invalid('Describe the help you need.'), location }
    case 'acknowledge_announcement':
      return { kind: body.kind, requestId: requestId ?? invalid('Provide the announcement ID.'), text }
    case 'availability_update': {
      const availability = body.availability
      if (availability !== undefined && availability !== 'available' && availability !== 'busy') {
        invalid('Choose available or busy.')
      }
      if (!availability && !location) invalid('Provide availability or a location.')
      return { kind: body.kind, availability, location, text }
    }
    case 'accept':
      return { kind: body.kind, requestId, offerId: offerId ?? invalid('Provide the offer ID.') }
    case 'decline':
      return { kind: body.kind, requestId, offerId: offerId ?? invalid('Provide the offer ID.'), text, location }
    case 'blocked':
      return { kind: body.kind, requestId: requestId ?? invalid('Provide the request ID.'), offerId, text, location }
    case 'report_delivery':
    case 'confirm_receipt':
      return { kind: body.kind, requestId: requestId ?? invalid('Provide the request ID.'), offerId, text }
    default:
      invalid('Unknown crew event kind.')
  }
}

export function readEventId(body: Record<string, unknown>): string {
  const eventId = required(body, 'eventId')
  if (!/^[a-zA-Z0-9_-]+$/.test(eventId)) invalid('Use letters, numbers, underscores or hyphens in eventId.')
  return eventId
}
