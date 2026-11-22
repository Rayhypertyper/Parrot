import type { CrewMember, CrewRequest } from '../../shared/crew/index'

const numbers = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const ordinals = ['ground', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']
const floorLabels = new Map([...numbers, ...ordinals].map((word, index) => [word, index % numbers.length]))
const floorNumber = ['\\d+(?:st|nd|rd|th)?', ...floorLabels.keys()].join('|')
const floorPattern = new RegExp(`\\b(?:(${floorNumber}) (?:floor|level)|(?:floor|level) (${floorNumber}))\\b`, 'g')

function normalizeLocation(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function readFloor(value: string) {
  const floors = new Set<number>()
  for (const match of value.matchAll(floorPattern)) {
    const word = match[1] ?? match[2]
    floors.add(floorLabels.get(word) ?? Number.parseInt(word, 10))
  }
  return floors.size === 1 ? floors.values().next().value : undefined
}

export function closestMembers(
  candidates: CrewMember[], request: Pick<CrewRequest, 'pickupLocation' | 'destination' | 'title'>,
): CrewMember[] | undefined {
  const target = normalizeLocation(request.pickupLocation ?? request.destination ?? request.title)
  const known = candidates.map(member => ({ member, location: normalizeLocation(member.location) }))
    .filter(({ location }) => location && !['unspecified', 'unknown', 'dashboard'].includes(location))
  const targetFloor = readFloor(target)
  if (targetFloor !== undefined) {
    const distances = known.flatMap(({ member, location }) => {
      const floor = readFloor(location)
      return floor === undefined ? [] : [{ member, distance: Math.abs(floor - targetFloor) }]
    })
    if (distances.length) {
      const closest = distances.reduce((nearest, { distance }) => Math.min(nearest, distance), Infinity)
      return distances.filter(({ distance }) => distance === closest).map(({ member }) => member)
    }
  }

  const exact = known.filter(({ location }) => location === target)
  if (exact.length) return exact.map(({ member }) => member)
  const locationsInRequest = known.filter(({ location }) => ` ${target} `.includes(` ${location} `))
  if (new Set(locationsInRequest.map(({ location }) => location)).size === 1) {
    return locationsInRequest.map(({ member }) => member)
  }
}
