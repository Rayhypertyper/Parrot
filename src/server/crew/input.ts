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
  if (body.kind !== 'request_help') invalid('Unknown crew event kind.')
  return { kind: 'request_help', text: required(body, 'text', 1000), location: field(body, 'location', 500) }
}

export function readEventId(body: Record<string, unknown>): string {
  const eventId = required(body, 'eventId')
  if (!/^[a-zA-Z0-9_-]+$/.test(eventId)) invalid('Use letters, numbers, underscores or hyphens in eventId.')
  return eventId
}
